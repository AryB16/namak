import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Eyebrow, SourceTag } from '../components/ui'
import { Term } from '../components/explain'
import { IconPause, IconPlay, IconSend } from '../components/icons'
import { CROPS } from '../engine/crops'
import { planFarm, type FarmPlan } from '../engine/farm'
import type { Farm } from '../engine/plan'
import { LANGS, templateInstruction, type Lang } from '../lib/instruction'
import { dayLabel, int, one, pct } from '../lib/format'
import {
  browserVoiceFor,
  cachedInstruction,
  instructionPlan,
  prepareNote,
  speakInBrowser,
  type ECRead,
  type Instruction,
} from '../lib/worker'
import type { InstructionPlan } from '../lib/instruction'
import { useApp } from '../state'
import { useDemoEvent } from '../demo/Demo'
import demo from '../data/demoAssets.json'

type VoiceSource = 'recorded' | 'gemini' | 'browser' | 'none'
type Step = 'idle' | 'writing' | 'recording' | 'ready'

/**
 * Example salt-meter photos. Their AI readings were made once (Gemini vision, scripts/make-demo-assets.mts) and saved,
 * so picking one always gives the same, instant result.
 */
const SAMPLES = (['ec-3.82-mscm', 'ec-4210-uscm', 'ec-2.64-mscm'] as const).map((id) => {
  const r = (demo.readings as Record<string, { raw: number; unit: string; ec: number; display: string; confidence: string }>)[id]
  return { id, src: `/samples/${id}.svg`, label: `${r.raw} ${r.unit}`, reading: r as ECRead }
})

const DEMO_PLAN = JSON.stringify(demo.plan)

/** The recorded AI message + voice for the demo day, if this plan is the demo day's plan. */
function recordedNote(p: InstructionPlan, lang: Lang): { instr: Instruction; audioUrl: string } | null {
  if (JSON.stringify(p) !== DEMO_PLAN) return null
  const v = (demo.voice as Record<string, { text: string; source: 'gemini' | 'template' }>)[lang]
  return v ? { instr: { text: v.text, source: v.source }, audioUrl: `/demo/voice-${lang}.m4a` } : null
}

export default function Worker() {
  const { farm, setFarm, planDays, addReading, online } = useApp()
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('namak.lang') as Lang) || 'hi'
    } catch {
      return 'hi'
    }
  })
  const plan = useMemo(() => (planDays.length ? planFarm(farm, planDays) : null), [farm, planDays])
  const iplan = useMemo(() => (plan ? instructionPlan(plan) : null), [plan])
  const isRecorded = !!(iplan && recordedNote(iplan, lang))

  const [step, setStep] = useState<Step>('idle')
  const [instr, setInstr] = useState<Instruction | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [voiceSrc, setVoiceSrc] = useState<VoiceSource>('none')
  const [sentAt, setSentAt] = useState<string>('')

  const [photo, setPhoto] = useState<string | null>(null)
  const [reading, setReading] = useState<'idle' | 'reading' | 'done'>('idle')
  const [read, setRead] = useState<ECRead | null>(null)
  const [diff, setDiff] = useState<{ before: FarmPlan; after: FarmPlan; from: number; to: number } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('namak.lang', lang)
    } catch {
      /* ignore */
    }
    setStep('idle')
    setInstr(null)
    setAudioUrl(null)
    setVoiceSrc('none')
  }, [lang])

  // Guided demo: send the note, then pick the first example photo and confirm it automatically.
  const autoConfirm = useRef(false)
  useDemoEvent('send-note', () => void send())
  useDemoEvent('read-sample', () => {
    autoConfirm.current = true
    analyse(SAMPLES[0])
  })
  useEffect(() => {
    if (!read || !autoConfirm.current) return
    autoConfirm.current = false
    const t = setTimeout(() => apply(read.ec), 1600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read])

  if (!plan || !iplan) return <Card>Loading tomorrow’s plan…</Card>
  const L = LANGS.find((l) => l.id === lang)!

  async function send() {
    if (!iplan) return
    setSentAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    // Demo day: the message and voice were made once by AI and saved — play them straight away.
    const rec = recordedNote(iplan, lang)
    if (rec) {
      setInstr(rec.instr)
      setAudioUrl(rec.audioUrl)
      setVoiceSrc('recorded')
      setStep('ready')
      return
    }
    // Live plan: show the ready-made text at once; swap in the AI wording and voice when they arrive.
    const cached = cachedInstruction(iplan, lang)
    setInstr(cached ?? { text: templateInstruction(iplan, lang), source: 'template' })
    setAudioUrl(null)
    setStep('writing')
    const job = prepareNote(iplan, lang, online)
    const first = await Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), 50))])
    if (!first) setStep('recording')
    const { instr: final, audioUrl: url } = first ?? (await job)
    setInstr(final)
    if (url) {
      setAudioUrl(url)
      setVoiceSrc('gemini')
    } else setVoiceSrc(browserVoiceFor(lang) ? 'browser' : 'none')
    setStep('ready')
  }

  function analyse(s: (typeof SAMPLES)[number]) {
    setPhoto(s.src)
    setRead(null)
    setDiff(null)
    setReading('reading')
    // The reading was made once by AI and saved; a short pause shows the "reading" step.
    window.setTimeout(() => {
      setRead(s.reading)
      setReading('done')
    }, 1300)
  }

  function apply(ec: number) {
    const before = planFarm(farm, planDays)
    const next: Farm = { ...farm, wellEC: Math.round(ec * 100) / 100 }
    const after = planFarm(next, planDays)
    setDiff({ before, after, from: farm.wellEC, to: next.wellEC })
    addReading({ at: new Date().toISOString(), ec: next.wellEC, previous: farm.wellEC, source: 'photo' })
    setFarm(next)
    setRead(null)
    setReading('idle')
  }

  const busy = step === 'writing' || step === 'recording'

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Telling the worker</Eyebrow>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold text-ink md:text-[48px]">Tomorrow’s plan, sent as a voice message</h1>
        <p className="mt-3 max-w-[760px] text-[16px] leading-relaxed text-ink/75">
          On many small farms, the owner plans the watering, but a hired worker turns the{' '}
          <Term k="valve">valves</Term> on and off. The worker often speaks another language and may not read well. So Namak turns
          the plan into a short spoken message in the worker’s own language.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[14px] font-semibold text-ink/75">Choose the worker’s language:</p>
        <div role="radiogroup" aria-label="Worker's language" className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={l.id === lang}
              onClick={() => setLang(l.id)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${l.id === lang ? 'bg-ink text-white' : 'glass text-ink hover:bg-white'}`}
            >
              <span lang={l.bcp47}>{l.native}</span>
              {l.id !== 'en' && <span className="ml-1.5 text-[11px] opacity-70">{l.name}</span>}
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full md:hidden" onClick={send} disabled={busy}>
        <IconSend className="h-4 w-4" /> {step === 'ready' ? 'Send again' : 'Send to the worker'}
      </Button>

      <div className="grid gap-5 md:grid-cols-[340px_1fr] md:items-start">
        <div data-demo="phone">
          <Phone>
            <ChatHeader />
            <div className="flex min-h-[440px] flex-col gap-3 px-3 py-4" aria-live="polite">
              <p className="mx-auto px-2.5 py-1 text-[11px] font-medium text-ink/65">Plan for {dayLabel(plan.days[0].date)}</p>
              {step === 'idle' && !photo && (
                <p className="mx-auto mt-16 max-w-[230px] text-center text-sm text-ink/65">
                  Press “Send to the worker” to create tomorrow’s voice message.
                </p>
              )}
              {instr && (
                <div className="ml-auto max-w-[88%] rounded-[20px] rounded-br-md bg-teal-water p-3 text-white">
                  <VoiceNote url={audioUrl} source={voiceSrc} busy={step !== 'ready'} text={instr.text} lang={lang} />
                  <p dir={L.rtl ? 'rtl' : 'ltr'} lang={L.bcp47} className="mt-2 text-[14px] leading-relaxed text-white">
                    {instr.text}
                  </p>
                  <p className="mt-1.5 text-right text-[11px] text-white/80">
                    {sentAt} ·{' '}
                    {step === 'writing'
                      ? `writing in ${L.name}…`
                      : step === 'recording'
                        ? `recording the voice in ${L.name}…`
                        : labelFor(instr, voiceSrc)}
                  </p>
                </div>
              )}
              {photo && (
                <div className="mr-auto max-w-[78%] rounded-[20px] rounded-bl-md bg-white p-2 shadow-sm">
                  <div className="relative overflow-hidden rounded-xl">
                    <img src={photo} alt="Photo of a salt meter's display, sent by the worker" className="max-h-52 w-full object-cover" />
                    {reading === 'reading' && <span className="scan-line" aria-hidden />}
                  </div>
                  <p className="mt-1.5 px-1 text-[13px] text-ink/80">Salt meter in well water</p>
                  {reading === 'reading' && <p className="px-1 text-[12px] text-teal-water">Reading the number…</p>}
                  {read && (
                    <p className="px-1 text-[12px] font-semibold text-teal-water">
                      Reads {read.raw} {read.unit}
                    </p>
                  )}
                </div>
              )}
              {diff && (
                <div className="mx-auto w-full rounded-2xl bg-ink px-3 py-2.5 text-[12px] text-white">
                  Plan updated for saltier water ({one(diff.from)} → {one(diff.to)} dS/m). A new voice message is ready.
                </div>
              )}
            </div>
          </Phone>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-[21px] font-semibold">1. Send the plan to the worker</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink/70">
              Namak writes two short sentences in {L.name} with each valve’s start time and number of minutes, then reads them
              aloud. Before sending, it checks that every number matches the plan.
            </p>
            <Button className="mt-3 hidden w-full md:inline-flex" onClick={send} disabled={busy}>
              <IconSend className="h-4 w-4" /> {step === 'ready' ? 'Send again' : 'Send to the worker'}
            </Button>
            <div className="mt-3 flex flex-wrap gap-2">
              <SourceTag>Written and voiced by AI (Google Gemini)</SourceTag>
              {isRecorded ? (
                <SourceTag tone="sand">Demo day: made once and saved</SourceTag>
              ) : (
                <SourceTag tone="sand">Written live for today’s forecast</SourceTag>
              )}
            </div>
          </Card>

          <div data-demo="ec">
            <Card>
              <h2 className="text-[21px] font-semibold">2. Check how salty the well is</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-ink/70">
                Well water slowly gets saltier as the well is pumped. Once a week, the worker dips a small{' '}
                <Term k="salt meter">salt meter</Term> (about AED 100) into a cup of well water and sends a photo. Namak reads the
                number and updates the plan. Pick one of the example photos:
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => analyse(s)}
                    disabled={reading === 'reading'}
                    className="overflow-hidden rounded-2xl ring-1 ring-sand-300 transition-shadow hover:ring-2 hover:ring-teal-water disabled:opacity-50"
                  >
                    <img src={s.src} alt={`Example photo of a salt meter showing ${s.label}`} className="aspect-[3/4] w-full object-cover" />
                    <span className="block bg-salt py-1.5 text-[12px] font-semibold">{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-ink/65">
                These are example photos. AI read each one once and the result was saved, so they always give the same answer.
              </p>

              {read && (
                <div className="mt-4 rounded-2xl bg-teal-water/8 p-4 ring-1 ring-teal-water/20">
                  <p className="text-[14px] leading-relaxed">
                    The meter shows <strong>{read.display || `${read.raw} ${read.unit}`}</strong>
                    {read.unit === 'µS/cm' ? `, which is ${one(read.ec)} in the units Namak uses (dS/m)` : ' (the same as dS/m)'}. Before, the
                    well was {one(farm.wellEC)}, so the water is now{' '}
                    {read.ec > farm.wellEC + 0.05 ? 'saltier' : read.ec < farm.wellEC - 0.05 ? 'less salty' : 'about the same'}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => apply(read.ec)}>Use this reading</Button>
                    <Button variant="quiet" onClick={() => setRead(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {diff && <DiffCard diff={diff} />}
        </div>
      </div>
    </div>
  )
}

function labelFor(instr: Instruction, voice: VoiceSource): string {
  if (voice === 'recorded') return 'written and voiced by AI · saved for the demo'
  const w = instr.source === 'gemini' ? 'written by AI' : 'ready-made text'
  const v = voice === 'gemini' ? 'AI voice' : voice === 'browser' ? 'phone voice' : 'text only'
  return `${w} · ${v}`
}

function DiffCard({ diff }: { diff: { before: FarmPlan; after: FarmPlan; from: number; to: number } }) {
  const totalB = diff.before.valves.reduce((a, v) => a + v.days[0].minutes, 0)
  const totalA = diff.after.valves.reduce((a, v) => a + v.days[0].minutes, 0)
  return (
    <Card>
      <Eyebrow>The plan has been updated</Eyebrow>
      <p className="mt-1 text-[24px] font-semibold text-ink">
        Well water: {one(diff.from)} → {one(diff.to)} dS/m
      </p>
      <p className="mt-1 text-[14px] text-ink/70">Here is how tomorrow changes:</p>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-[12px] text-ink/65">
          <tr>
            <th className="py-1 font-semibold">Valve</th>
            <th className="font-semibold">Minutes</th>
            <th className="font-semibold">Extra water to wash out salt</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {diff.after.valves.map((va, i) => {
            const vb = diff.before.valves[i]
            const d = va.days[0].minutes - vb.days[0].minutes
            return (
              <tr key={va.valve.id} className="border-t border-sand-200">
                <td className="py-2 font-semibold">
                  {va.valve.name} · {CROPS[va.valve.cropId].short}
                </td>
                <td>
                  {int(vb.days[0].minutes)} → <strong>{int(va.days[0].minutes)}</strong>{' '}
                  <span className={d > 0 ? 'text-[#9a5d12]' : 'text-green-ok'}>
                    ({d >= 0 ? '+' : ''}
                    {int(d)})
                  </span>
                </td>
                <td>
                  {pct(vb.days[0].lr)} → {pct(va.days[0].lr)}
                  {va.blend.needed && !vb.blend.needed && <span className="block text-[12px] text-[#9a5d12]">now needs clean water mixed in</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[14px] text-ink/70">
        In total, tomorrow goes from {int(totalB)} to {int(totalA)} minutes. Saltier water needs more extra water to wash the salt
        away from the roots. Send the new voice message so the worker has the updated times.
      </p>
    </Card>
  )
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[50px] bg-[#2a2a2c] p-3 shadow-[0_40px_90px_-40px_rgba(10,111,105,0.6)] ring-1 ring-black/10">
      <div className="overflow-hidden rounded-[40px] bg-[#f2f2f7]">
        <div className="flex items-center justify-between px-7 pt-3.5 pb-1 text-[12px] font-semibold text-ink">
          <span className="tabular">05:12</span>
          <span className="h-[26px] w-24 rounded-full bg-black" aria-hidden />
          <span className="tabular">4G</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function ChatHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-black/5 bg-white/85 px-4 py-3 text-ink">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-glow-salt text-[15px] font-semibold text-ink">W</div>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold">Farm worker</p>
        <p className="text-[12px] text-ink/65">voice messages · valves 1–3</p>
      </div>
    </div>
  )
}

function bars(seed: string, n = 32) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0
    return 0.25 + (((h >>> 16) % 1000) / 1000) * 0.75 * (0.6 + 0.4 * Math.sin(i / 3))
  })
}

function VoiceNote({ url, source, busy, text, lang }: { url: string | null; source: VoiceSource; busy: boolean; text: string; lang: Lang }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dur, setDur] = useState(0)
  const b = useMemo(() => bars(text), [text])

  useEffect(() => {
    setProgress(0)
    setPlaying(false)
    if (!url) {
      audio.current = null
      return
    }
    const a = new Audio(url)
    audio.current = a
    a.onloadedmetadata = () => setDur(a.duration)
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0)
    a.onended = () => {
      setPlaying(false)
      setProgress(1)
    }
    // Play the fresh message once (allowed after the click that sent it).
    a.play()
      .then(() => setPlaying(true))
      .catch(() => {})
    return () => {
      a.pause()
    }
  }, [url])

  const toggle = () => {
    if (source === 'browser') {
      if (playing) {
        speechSynthesis.cancel()
        setPlaying(false)
        return
      }
      setPlaying(speakInBrowser(text, lang, () => setPlaying(false)))
      return
    }
    const a = audio.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => {})
    }
  }

  const disabled = busy || (source === 'none' && !url)
  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={toggle}
        disabled={disabled}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-40"
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : playing ? (
          <IconPause className="h-4 w-4" />
        ) : (
          <IconPlay className="h-4 w-4" />
        )}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden>
        {b.map((h, i) => (
          <span key={i} className={`w-[3px] rounded-full ${i / b.length <= progress ? 'bg-white' : 'bg-white/40'}`} style={{ height: `${h * 100}%` }} />
        ))}
      </div>
      <span className="w-9 text-right text-[11px] tabular text-white/80">
        {dur ? `0:${String(Math.round(dur)).padStart(2, '0')}` : busy ? '…' : ''}
      </span>
    </div>
  )
}
