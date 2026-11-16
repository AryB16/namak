/** Client helpers for the Worker screen: plan → instruction, AI calls with fallbacks, image prep. */
import type { FarmPlan } from '../engine/farm'
import { LANGS, templateInstruction, type InstructionPlan, type Lang } from './instruction'

export function instructionPlan(plan: FarmPlan): InstructionPlan {
  return {
    date: plan.days[0]?.date ?? '',
    valves: plan.valves.map((vp, i) => {
      const slot = plan.schedule.find((s) => s.valveId === vp.valve.id)
      const n = Number(vp.valve.name.match(/\d+/)?.[0] ?? i + 1)
      return { n, minutes: Math.round(vp.days[0]?.minutes ?? 0), start: slot?.start ?? '05:00', repayment: !!vp.days[0]?.isRepaymentDay }
    }),
  }
}

const key = (p: InstructionPlan, lang: Lang) => `namak.instr.v1:${lang}:${JSON.stringify(p)}`

export interface Instruction {
  text: string
  source: 'gemini' | 'template'
  note?: string
}

/** Cached instruction for this plan + language, if we made one before (works offline). */
export function cachedInstruction(p: InstructionPlan, lang: Lang): Instruction | null {
  try {
    const raw = localStorage.getItem(key(p, lang))
    return raw ? (JSON.parse(raw) as Instruction) : null
  } catch {
    return null
  }
}

export async function fetchInstruction(p: InstructionPlan, lang: Lang): Promise<Instruction> {
  const fallback: Instruction = { text: templateInstruction(p, lang), source: 'template', note: 'Offline template' }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25_000)
    const res = await fetch('/api/instruct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, plan: p }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return fallback
    const j = (await res.json()) as { text: string; source: 'gemini' | 'template'; reason?: string }
    const out: Instruction = { text: j.text, source: j.source, note: j.reason }
    try {
      localStorage.setItem(key(p, lang), JSON.stringify(out))
    } catch {
      /* ignore */
    }
    return out
  } catch {
    return fallback
  }
}

export type VoiceSource = 'gemini' | 'browser' | 'sample' | 'none'

/** Gemini TTS via /api/voice. Returns an object URL, or null if unavailable. */
export async function fetchVoice(text: string, lang: Lang): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 50_000)
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('audio/')) return null
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}

/** Browser speech for the language, if this device has a matching voice. */
export function browserVoiceFor(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const tag = LANGS.find((l) => l.id === lang)!.bcp47.slice(0, 2)
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(tag)) ?? null
}

export function speakInBrowser(text: string, lang: Lang, onEnd: () => void): boolean {
  const v = browserVoiceFor(lang)
  if (!v) return false
  const u = new SpeechSynthesisUtterance(text)
  u.voice = v
  u.lang = v.lang
  u.rate = 0.92
  u.onend = onEnd
  u.onerror = onEnd
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
  return true
}

/** Load a File or URL into a JPEG (max 1024 px) and return base64 without the data: prefix. */
export async function toJpegBase64(src: File | string): Promise<{ base64: string; preview: string }> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  await img.decode()
  const scale = Math.min(1, 1024 / Math.max(img.naturalWidth || 900, img.naturalHeight || 1200))
  const w = Math.round((img.naturalWidth || 900) * scale)
  const h = Math.round((img.naturalHeight || 1200) * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const preview = c.toDataURL('image/jpeg', 0.85)
  if (typeof src !== 'string') URL.revokeObjectURL(url)
  return { base64: preview.split(',')[1], preview }
}

export interface ECRead {
  ec: number
  raw: number
  unit: string
  confidence: string
  display: string
  unitAssumed?: boolean
}

export async function readEC(base64: string): Promise<{ ok: true; read: ECRead } | { ok: false; error: string }> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 30_000)
    const res = await fetch('/api/read-ec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mime: 'image/jpeg' }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: j.error ?? 'Could not read the photo.' }
    return { ok: true, read: j as ECRead }
  } catch {
    return { ok: false, error: 'No connection. Type the number from the pen instead.' }
  }
}

export interface Prepared {
  instr: Instruction
  audioUrl: string | null
}

const prepared = new Map<string, Promise<Prepared>>()

/**
 * Write + record the voice note once per (plan, language) and keep it in memory, so pressing "Send" is instant when
 * the Worker screen has been open for a few seconds. Gemini TTS takes ~5–25 s depending on length.
 */
export function prepareNote(p: InstructionPlan, lang: Lang, online: boolean): Promise<Prepared> {
  const k = `${lang}:${JSON.stringify(p)}`
  const hit = prepared.get(k)
  if (hit) return hit
  const job = (async (): Promise<Prepared> => {
    if (!online) {
      const cached = cachedInstruction(p, lang)
      return { instr: cached ?? { text: templateInstruction(p, lang), source: 'template', note: 'Offline template' }, audioUrl: null }
    }
    const instr = await fetchInstruction(p, lang)
    const audioUrl = await fetchVoice(instr.text, lang)
    return { instr, audioUrl }
  })()
  prepared.set(k, job)
  // Failed or offline attempts are not cached, so a later Send retries.
  job.then((r) => {
    if (!r.audioUrl) prepared.delete(k)
  })
  return job
}
