import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Eyebrow, SourceTag } from '../components/ui'
import { IconCamera, IconPause, IconPlay, IconSend } from '../components/icons'
import { CROPS } from '../engine/crops'
import { planFarm, type FarmPlan } from '../engine/farm'
import type { Farm } from '../engine/plan'
import { LANGS, templateInstruction, type Lang } from '../lib/instruction'
import { int, one, pct } from '../lib/format'
import {
  browserVoiceFor,
  cachedInstruction,
  instructionPlan,
  prepareNote,
  readEC,
  speakInBrowser,
  toJpegBase64,
  type ECRead,
  type Instruction,
  type VoiceSource,
} from '../lib/worker'
import { useApp } from '../state'
import sampleVoice from '../data/sampleVoice.json'

const SAMPLES = [
  { src: '/samples/ec-3.82-mscm.svg', label: '3.82 mS/cm' },
  { src: '/samples/ec-4210-uscm.svg', label: '4210 µS/cm' },
  { src: '/samples/ec-2.64-mscm.svg', label: '2.64 mS/cm' },
]

type Step = 'idle' | 'writing' | 'recording' | 'ready'

export default function Worker() {
  const { farm, setFarm, planDays, addReading, online } = useApp()
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('namak.lang') as Lang) || 'hi')
  const plan = useMemo(() => (planDays.length ? planFarm(farm, planDays) : null), [farm, planDays])
  const iplan = useMemo(() => (plan ? instructionPlan(plan) : null), [plan])

  const [step, setStep] = useState<Step>('idle')
  const [instr, setInstr] = useState<Instruction | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [voiceSrc, setVoiceSrc] = useState<VoiceSource>('none')
  const [sentAt, setSentAt] = useState<string>('')

  const [photo, setPhoto] = useState<string | null>(null)
  const [reading, setReading] = useState<'idle' | 'reading' | 'done' | 'error'>('idle')
  const [read, setRead] = useState<ECRead | null>(null)
  const [readError, setReadError] = useState('')
  const [manual, setManual] = useState('')
  const [diff, setDiff] = useState<{ before: FarmPlan; after: FarmPlan; from: number; to: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Prepare the note in the background as soon as the screen is open (instant "Send").
  useEffect(() => {
    if (iplan && online) void prepareNote(iplan, lang, online)
  }, [iplan, lang, online])

  if (!plan || !iplan) return <Card>Loading tomorrow’s plan…</Card>
  const L = LANGS.find((l) => l.id === lang)!

  async function send() {
    if (!iplan) return
    setSentAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    // Show the offline template immediately; replace it with Gemini's wording when it arrives.
    const cached = cachedInstruction(iplan, lang)
    setInstr(cached ?? { text: templateInstruction(iplan, lang), source: 'template', note: 'drafting…' })
    setAudioUrl(null)
    setStep('writing')
    const job = prepareNote(iplan, lang, online)
    const first = await Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), 50))])
    if (!first) {
      // Not ready yet: show progress while the text and then the voice arrive.
      setStep('recording')
    }
    const { instr: final, audioUrl: url } = first ?? (await job)
    setInstr(final)
    if (url) {
      setAudioUrl(url)
      setVoiceSrc('gemini')
    } else if (browserVoiceFor(lang)) {
      setVoiceSrc('browser')
    } else if ((sampleVoice.texts as Record<string, string>)[lang]) {
      setAudioUrl(`/audio/sample-${lang}.m4a`)
      setVoiceSrc('sample')
    } else setVoiceSrc('none')
    setStep('ready')
  }

  async function analyse(src: File | string) {
    setReading('reading')
    setRead(null)
    setReadError('')
    setDiff(null)
    try {
      const { base64, preview } = await toJpegBase64(src)
      setPhoto(preview)
      if (!online) {
        setReading('error')
        setReadError('Offline — type the number from the pen.')
        return
      }
      const r = await readEC(base64)
      if (r.ok) {
        setRead(r.read)
        setReading('done')
      } else {
        setReading('error')
        setReadError(r.error)
      }
    } catch {
      setReading('error')
      setReadError('Could not open that image.')
    }
  }

  function apply(ec: number, source: 'photo' | 'manual') {
    const before = planFarm(farm, planDays)
    const next: Farm = { ...farm, wellEC: Math.round(ec * 100) / 100 }
    const after = planFarm(next, planDays)
    setDiff({ before, after, from: farm.wellEC, to: next.wellEC })
    addReading({ at: new Date().toISOString(), ec: next.wellEC, previous: farm.wellEC, source })
    setFarm(next)
    setRead(null)
    setReading('idle')
    setManual('')
  }

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Worker · the person at the valve</Eyebrow>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold text-ink md:text-[48px]">Tomorrow’s plan, as a voice note.</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/75">
          The owner decides; the worker opens the valves. Namak sends the exact minutes in the worker’s language — no reading
          needed — and the worker sends back a photo of a ~AED 100 EC pen dipped in the well.
        </p>
      </div>

      <div role="radiogroup" aria-label="Worker's language" className="flex flex-wrap gap-2">
        {LANGS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={l.id === lang}
            onClick={() => setLang(l.id)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${l.id === lang ? 'bg-ink text-white' : 'bg-salt text-ink hover:bg-white/60'}`}
          >
            <span lang={l.bcp47}>{l.native}</span>
            {l.id !== 'en' && <span className="ml-1.5 text-[11px] opacity-70">{l.name}</span>}
          </button>
        ))}
      </div>

      <Button className="w-full md:hidden" onClick={send} disabled={step === 'writing' || step === 'recording'}>
        <IconSend className="h-4 w-4" /> {step === 'ready' ? 'Send again' : 'Send to worker'}
      </Button>

      <div className="grid gap-5 md:grid-cols-[340px_1fr] md:items-start">
        <Phone>
          <ChatHeader />
          <div className="flex min-h-[440px] flex-col gap-3 px-3 py-4" aria-live="polite">
            <p className="mx-auto rounded-lg bg-salt/80 px-2.5 py-1 text-[11px] text-ink/70">Tomorrow · {plan.days[0].date}</p>
            {step === 'idle' && !photo && (
              <p className="mx-auto mt-16 max-w-[220px] text-center text-sm text-ink/65">Press “Send to worker” to make tomorrow’s voice note.</p>
            )}
            {instr && (
              <div className="ml-auto max-w-[88%] rounded-[20px] rounded-br-md bg-teal-water p-3 text-white">
                <VoiceNote url={audioUrl} source={voiceSrc} busy={step !== 'ready'} text={instr.text} lang={lang} />
                <p dir={L.rtl ? 'rtl' : 'ltr'} lang={L.bcp47} className="mt-2 text-[14px] leading-relaxed text-white">
                  {instr.text}
                </p>
                <p className="mt-1.5 text-right text-[10px] text-white/75">
                  {sentAt} · {step === 'writing' ? `writing in ${L.name}…` : step === 'recording' ? `writing & recording in ${L.name} — about 20 s…` : labelFor(instr, voiceSrc)}
                </p>
              </div>
            )}
            {photo && (
              <div className="mr-auto max-w-[78%] rounded-[20px] rounded-bl-md bg-white p-2 shadow-sm">
                <img src={photo} alt="Photo of an EC pen display sent by the worker" className="max-h-52 w-full rounded-xl object-cover" />
                <p className="mt-1.5 px-1 text-[13px] text-ink/80">EC pen, well water</p>
                {reading === 'reading' && <p className="px-1 text-[11px] text-teal-water">Namak is reading the display…</p>}
                {read && (
                  <p className="px-1 text-[12px] font-semibold text-teal-water">
                    Read: {read.raw} {read.unit} = {one(read.ec)} dS/m
                  </p>
                )}
              </div>
            )}
            {diff && (
              <div className="mx-auto w-full rounded-2xl bg-ink px-3 py-2.5 text-[12px] text-white">
                Plan updated: well {one(diff.from)} → {one(diff.to)} dS/m. New voice note ready to send.
              </div>
            )}
          </div>
        </Phone>

        <div className="space-y-4">
          <Card>
            <h2 className="text-[21px] font-semibold">1 · Send tomorrow’s plan</h2>
            <p className="mt-1 text-[13px] text-ink/65">
              Two sentences in {L.name}, written by AI from the plan and checked number-by-number against it. If the AI is slow,
              offline or changes a number, Namak uses its built-in template.
            </p>
            <Button className="mt-3 hidden w-full md:inline-flex" onClick={send} disabled={step === 'writing' || step === 'recording'}>
              <IconSend className="h-4 w-4" /> {step === 'ready' ? 'Send again' : 'Send to worker'}
            </Button>
            <div className="mt-3 flex flex-wrap gap-2">
              <SourceTag>AI · Gemini (server-side)</SourceTag>
              <SourceTag tone="sand">Fallback · template + phone voice</SourceTag>
            </div>
          </Card>

          <Card>
            <h2 className="text-[21px] font-semibold">2 · Worker sends an EC reading</h2>
            <p className="mt-1 text-[13px] text-ink/65">
              The pen goes in a cup of well water; the worker photographs the display. AI reads the number, you confirm, and the
              plan recalculates. Try a sample photo:
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.src}
                  onClick={() => analyse(s.src)}
                  disabled={reading === 'reading'}
                  className="overflow-hidden rounded-2xl ring-1 ring-sand-300 hover:ring-teal-water disabled:opacity-50"
                >
                  <img src={s.src} alt={`Sample EC pen photo showing ${s.label}`} className="aspect-[3/4] w-full object-cover" />
                  <span className="block bg-salt py-1.5 text-[11px] font-semibold">{s.label}</span>
                </button>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) analyse(f)
                e.target.value = ''
              }}
            />
            <Button variant="ghost" className="mt-3 w-full" onClick={() => fileRef.current?.click()} disabled={reading === 'reading'}>
              <IconCamera className="h-4 w-4" /> Take or upload a photo
            </Button>
            <p className="mt-2 text-[11px] text-ink/65">Sample photos are drawings made for this demo, not real pen photos.</p>

            {reading === 'reading' && <p className="mt-3 text-sm font-semibold text-teal-water">Reading the display…</p>}
            {read && (
              <div className="mt-4 rounded-2xl bg-teal-water/8 p-4 ring-1 ring-teal-water/20">
                <p className="text-sm">
                  AI read <strong>{read.display || `${read.raw} ${read.unit}`}</strong> ({read.confidence} confidence)
                  {read.unitAssumed && ' — unit not visible, assumed mS/cm'}.
                </p>
                <p className="mt-1 text-[28px] font-semibold text-ink">
                  Well water {one(read.ec)} dS/m <span className="font-sans text-sm font-semibold text-ink/65">(was {one(farm.wellEC)})</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => apply(read.ec, 'photo')}>Confirm & update plan</Button>
                  <Button variant="quiet" onClick={() => setRead(null)}>
                    Not right
                  </Button>
                </div>
              </div>
            )}
            {(reading === 'error' || (reading === 'idle' && !read && photo && !diff)) && (
              <ManualEntry error={readError} value={manual} onChange={setManual} onApply={(n) => apply(n, 'manual')} />
            )}
          </Card>

          {diff && <DiffCard diff={diff} />}
        </div>
      </div>
    </div>
  )
}

function labelFor(instr: Instruction, voice: VoiceSource): string {
  const w = instr.source === 'gemini' ? 'AI-written' : 'template'
  const v =
    voice === 'gemini'
      ? 'AI voice'
      : voice === 'browser'
        ? 'phone voice'
        : voice === 'sample'
          ? 'recorded sample (minutes may differ)'
          : 'text only'
  return `${w} · ${v}`
}

function ManualEntry({ error, value, onChange, onApply }: { error: string; value: string; onChange: (s: string) => void; onApply: (n: number) => void }) {
  const n = Number(value)
  const ok = value !== '' && Number.isFinite(n) && n > 0 && n <= 20
  return (
    <div className="mt-4 rounded-2xl bg-amber-warn/10 p-4 ring-1 ring-amber-warn/30">
      {error && <p className="text-sm font-semibold text-[#8a5413]">{error}</p>}
      <label className="mt-2 block text-sm font-semibold">
        Type the pen reading (mS/cm = dS/m)
        <input
          inputMode="decimal"
          className="mt-1.5 min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-[15px]"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(',', '.'))}
          placeholder="e.g. 3.8"
        />
      </label>
      <Button className="mt-3" disabled={!ok} onClick={() => onApply(n)}>
        Update plan
      </Button>
    </div>
  )
}

function DiffCard({ diff }: { diff: { before: FarmPlan; after: FarmPlan; from: number; to: number } }) {
  const totalB = diff.before.valves.reduce((a, v) => a + v.days[0].minutes, 0)
  const totalA = diff.after.valves.reduce((a, v) => a + v.days[0].minutes, 0)
  return (
    <Card className="border-teal-water/30">
      <Eyebrow>Plan recalculated</Eyebrow>
      <p className="mt-1 text-[28px] font-semibold text-ink">
        Well water {one(diff.from)} → {one(diff.to)} dS/m
      </p>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-[11px] text-ink/65">
          <tr>
            <th className="py-1 font-semibold">Tomorrow</th>
            <th className="font-semibold">Minutes</th>
            <th className="font-semibold">Salt flush</th>
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
                <td className="tabular">
                  {int(vb.days[0].minutes)} → <strong>{int(va.days[0].minutes)}</strong>{' '}
                  <span className={d > 0 ? 'text-[#9a5d12]' : 'text-green-ok'}>
                    ({d >= 0 ? '+' : ''}
                    {int(d)})
                  </span>
                </td>
                <td className="tabular">
                  {pct(vb.days[0].lr)} → {pct(va.days[0].lr)}
                  {va.blend.needed && !vb.blend.needed && <span className="block text-[11px] text-[#9a5d12]">now needs blending</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-ink/70">
        Total tomorrow: {int(totalB)} → {int(totalA)} min. Saltier water needs more water through the soil to keep the salt
        below each crop’s limit. Send the new voice note so the worker has the updated minutes.
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
    <div className="flex items-center gap-3 border-b border-black/5 bg-white/85 px-4 py-3 text-ink backdrop-blur">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-glow-salt text-[15px] font-semibold text-ink">W</div>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold">Farm worker</p>
        <p className="text-[12px] text-ink/60">voice notes · Valves 1–3</p>
      </div>
    </div>
  )
}

function bars(seed: string, n = 32) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0
    return 0.25 + ((h >>> 16) % 1000) / 1000 * 0.75 * (0.6 + 0.4 * Math.sin(i / 3))
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
    // Autoplay the fresh note once (allowed after the click that sent it).
    a.play().then(() => setPlaying(true)).catch(() => {})
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
      a.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const disabled = busy || (source === 'none' && !url)
  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={toggle}
        disabled={disabled}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-40"
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : playing ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden>
        {b.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${i / b.length <= progress ? 'bg-white' : 'bg-white/40'}`}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
      <span className="w-9 text-right tabular text-[10px] text-white/75">{dur ? `0:${String(Math.round(dur)).padStart(2, '0')}` : busy ? '…' : '0:12'}</span>
    </div>
  )
}
