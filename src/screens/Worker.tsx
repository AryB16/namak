/**
 * The farmer's phone: a chat with Namak, the farm assistant (AI by Google Gemini).
 *   1. Namak asks for a photo of the salt meter in a cup of well water.
 *   2. Gemini reads the meter; the farmer confirms the number; Namak updates tomorrow's plan.
 *   3. The farmer picks a language; Gemini writes the plan and records it as a voice message.
 * On the demo day the Gemini answers were made once and saved (instant, no AI calls). Otherwise each answer is made
 * once by Gemini and shared through the CDN cache.
 */
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Card, Eyebrow, SourceTag } from '../components/ui'
import { IconPause, IconPlay } from '../components/icons'
import { EASE } from '../components/motion'
import { CROPS } from '../engine/crops'
import { planFarm, type FarmPlan } from '../engine/farm'
import type { Farm } from '../engine/plan'
import { LANGS, type InstructionPlan, type Lang } from '../lib/instruction'
import { int, minutes as fmtMin, one, pct } from '../lib/format'
import { browserVoiceFor, fetchInstruction, fetchVoice, instructionPlan, speakInBrowser, type ECRead } from '../lib/worker'
import { useApp } from '../state'
import { useDemoEvent } from '../demo/Demo'
import demo from '../data/demoAssets.json'

type SampleId = 'ec-3.82-mscm' | 'ec-4210-uscm' | 'ec-2.64-mscm'
const SAMPLES = (['ec-3.82-mscm', 'ec-4210-uscm', 'ec-2.64-mscm'] as SampleId[]).map((id) => {
  const r = (demo.readings as Record<string, ECRead & { raw: number; unit: string }>)[id]
  return { id, src: `/samples/${id}.svg`, label: `${r.raw} ${r.unit}`, reading: r }
})

type ByReading = Record<string, { plan: InstructionPlan; voice: Record<string, { text: string; source: 'gemini' | 'template' }> }>

/** Saved Gemini message + voice for this exact plan (demo day), if there is one. */
function savedVoice(sample: SampleId | null, p: InstructionPlan, lang: Lang) {
  if (!sample) return null
  const entry = (demo.byReading as ByReading)[sample]
  if (!entry || JSON.stringify(entry.plan) !== JSON.stringify(p)) return null
  const v = entry.voice[lang]
  return v ? { text: v.text, url: `/demo/voice-${sample}-${lang}.m4a` } : null
}

type Stage = 'ask-photo' | 'reading' | 'confirm' | 'ask-lang' | 'generating' | 'done'
type Msg =
  | { id: number; from: 'bot' | 'farmer'; kind: 'text'; text: ReactNode }
  | { id: number; from: 'farmer'; kind: 'photo'; src: string }
  | { id: number; from: 'bot'; kind: 'thinking'; label: string }
  | { id: number; from: 'bot'; kind: 'voice'; text: string; url: string | null; lang: Lang; browser: boolean }

type NewMsg = Msg extends unknown ? (Msg extends infer T ? (T extends Msg ? Omit<T, 'id'> : never) : never) : never

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Worker() {
  const { farm, setFarm, planDays, addReading, online, demoDay } = useApp()
  const nextId = useRef(1)
  const [msgs, setMsgs] = useState<Msg[]>(() => initialMsgs())
  const [stage, setStage] = useState<Stage>('ask-photo')
  const [pending, setPending] = useState<(typeof SAMPLES)[number] | null>(null)
  const [sample, setSample] = useState<SampleId | null>(null)
  const [diff, setDiff] = useState<{ before: FarmPlan; after: FarmPlan; from: number; to: number } | null>(null)
  const autoConfirm = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)
  const farmRef = useRef(farm)
  farmRef.current = farm

  function initialMsgs(): Msg[] {
    return [
      { id: 0, from: 'bot', kind: 'text', text: 'Hi! I’m Namak, your farm assistant.' },
      {
        id: -1,
        from: 'bot',
        kind: 'text',
        text: 'Before I send tomorrow’s watering times, please send me a photo of your salt meter dipped in a cup of well water.',
      },
    ]
  }

  const push = (m: NewMsg) => {
    const id = nextId.current++
    setMsgs((x) => [...x, { ...m, id } as Msg])
    return id
  }
  const replace = (id: number, m: NewMsg) => setMsgs((x) => x.map((y) => (y.id === id ? ({ ...m, id } as Msg) : y)))
  const relabel = (id: number, label: string) => setMsgs((x) => x.map((y) => (y.id === id && y.kind === 'thinking' ? { ...y, label } : y)))

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  const plan = useMemo(() => (planDays.length ? planFarm(farm, planDays) : null), [farm, planDays])

  // 1. Farmer sends a meter photo -> Gemini reads it.
  async function sendPhoto(s: (typeof SAMPLES)[number]) {
    if (stage !== 'ask-photo') return
    setStage('reading')
    push({ from: 'farmer', kind: 'photo', src: s.src })
    await wait(350)
    const t = push({ from: 'bot', kind: 'thinking', label: 'Gemini is reading the meter…' })
    // The reading of this example photo was made once by Gemini and saved.
    await wait(1600)
    replace(t, {
      from: 'bot',
      kind: 'text',
      text: (
        <>
          The meter shows <strong>{s.label}</strong>
          {s.reading.unit === 'µS/cm' ? <> — that’s <strong>{one(s.reading.ec)}</strong> on Namak’s scale</> : null}. Is that right?
        </>
      ),
    })
    setPending(s)
    setStage('confirm')
  }

  // 2. Farmer confirms -> Namak updates tomorrow's plan.
  async function confirm(yes: boolean) {
    if (stage !== 'confirm' || !pending) return
    if (!yes) {
      push({ from: 'farmer', kind: 'text', text: 'No, I’ll send another photo.' })
      await wait(400)
      push({ from: 'bot', kind: 'text', text: 'No problem — please send another photo.' })
      setPending(null)
      setStage('ask-photo')
      return
    }
    push({ from: 'farmer', kind: 'text', text: 'Yes, that’s right.' })
    const f = farmRef.current
    const ec = Math.round(pending.reading.ec * 100) / 100
    const before = planFarm(f, planDays)
    const next: Farm = { ...f, wellEC: ec }
    const after = planFarm(next, planDays)
    const tB = before.valves.reduce((a, v) => a + v.days[0].minutes, 0)
    const tA = after.valves.reduce((a, v) => a + v.days[0].minutes, 0)
    setDiff({ before, after, from: f.wellEC, to: ec })
    addReading({ at: new Date().toISOString(), ec, previous: f.wellEC, source: 'photo' })
    setFarm(next)
    setSample(pending.id)
    setPending(null)
    await wait(500)
    const change =
      ec > f.wellEC + 0.05
        ? `Your well is saltier than last time (${one(f.wellEC)} → ${one(ec)}), so I’ve added a little more water to wash the salt out.`
        : ec < f.wellEC - 0.05
          ? `Your well is less salty than last time (${one(f.wellEC)} → ${one(ec)}), so I’ve cut back a little.`
          : 'Your well is about the same as last time.'
    push({ from: 'bot', kind: 'text', text: `Thanks! ${change} Tomorrow’s total: ${fmtMin(tB)} → ${fmtMin(tA)}.` })
    await wait(600)
    push({ from: 'bot', kind: 'text', text: 'Which language should I send tomorrow’s plan in?' })
    setStage('ask-lang')
  }

  // 3. Farmer picks a language -> Gemini writes and voices the plan.
  async function chooseLang(lang: Lang) {
    if ((stage !== 'ask-lang' && stage !== 'done') || !plan) return
    const L = LANGS.find((l) => l.id === lang)!
    setStage('generating')
    push({ from: 'farmer', kind: 'text', text: <span lang={L.bcp47}>{L.native}</span> })
    await wait(300)
    const t = push({ from: 'bot', kind: 'thinking', label: `Gemini is writing tomorrow’s plan in ${L.name}…` })
    const p = instructionPlan(planFarm(farmRef.current, planDays))
    const saved = savedVoice(sample, p, lang)
    let text: string
    let url: string | null
    if (saved) {
      await wait(1300)
      relabel(t, `Gemini is recording the voice message…`)
      await wait(1200)
      text = saved.text
      url = saved.url
    } else {
      const started = Date.now()
      const ins = await fetchInstruction(p, lang)
      await wait(Math.max(0, 900 - (Date.now() - started)))
      relabel(t, `Gemini is recording the voice message…`)
      const s2 = Date.now()
      url = online ? await fetchVoice(ins.text, lang) : null
      await wait(Math.max(0, 900 - (Date.now() - s2)))
      text = ins.text
    }
    replace(t, { from: 'bot', kind: 'voice', text, url, lang, browser: !url && !!browserVoiceFor(lang) })
    setStage('done')
  }

  function restart() {
    setMsgs(initialMsgs())
    setPending(null)
    setSample(null)
    setDiff(null)
    setStage('ask-photo')
  }

  // Guided demo: send the first example photo and confirm it; then ask for the plan in Hindi.
  useDemoEvent('read-sample', () => {
    autoConfirm.current = true
    if (stage !== 'ask-photo') restart()
    setTimeout(() => void sendPhoto(SAMPLES[0]), stage !== 'ask-photo' ? 300 : 0)
  })
  useEffect(() => {
    if (stage === 'confirm' && autoConfirm.current) {
      autoConfirm.current = false
      const t = setTimeout(() => void confirm(true), 1300)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])
  useDemoEvent('send-note', () => void chooseLang('hi'))

  if (!plan) return <Card>Loading tomorrow’s plan…</Card>

  const step = stage === 'ask-photo' || stage === 'reading' || stage === 'confirm' ? 1 : stage === 'ask-lang' ? 2 : 3
  const isSaved = demoDay

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>The farmer’s phone</Eyebrow>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold text-ink md:text-[48px]">A farm assistant in the farmer’s pocket</h1>
        <p className="mt-3 max-w-[780px] text-[16px] leading-relaxed text-ink/75">
          This is what the person who works on the farm sees. Namak chats with them like a supervisor would: it asks for one
          quick check of the well water, updates the plan, and sends tomorrow’s watering times as a voice message in their own
          language. Try it — tap the options on the phone.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[360px_1fr] md:items-start">
        <div data-demo="phone">
          <Phone>
            <ChatHeader />
            <div ref={scroller} className="flex h-[440px] flex-col gap-2.5 overflow-y-auto px-3 py-4" aria-live="polite">
              <AnimatePresence initial={false}>
                {msgs.map((msg) => (
                  <m.div
                    key={msg.id}
                    layout="position"
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className={msg.from === 'farmer' ? 'ml-auto max-w-[82%]' : 'mr-auto max-w-[88%]'}
                  >
                    <Bubble msg={msg} />
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
            <Replies
              stage={stage}
              onPhoto={sendPhoto}
              onConfirm={confirm}
              onLang={chooseLang}
              onRestart={restart}
            />
          </Phone>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-[21px] font-semibold">What’s happening</h2>
            <ol className="mt-4 space-y-4">
              <Step n={1} active={step === 1} done={step > 1} title="The farmer checks the well water">
                Well water slowly gets saltier as it is pumped, and saltier water needs more water to wash the salt out of the soil.
                So once a week the farmer dips a cheap salt meter (about AED 100) in a cup of well water and sends Namak a photo.
              </Step>
              <Step n={2} active={step === 2} done={step > 2} title="Gemini reads it, Namak updates the plan">
                Gemini reads the number in the photo. After the farmer confirms it, Namak recalculates how long each valve
                should run tomorrow.
              </Step>
              <Step n={3} active={step === 3} done={stage === 'done'} title="Gemini sends the plan as a voice message">
                Many farm workers don’t read English and are busy in the field. So Gemini writes tomorrow’s times in the
                farmer’s language and reads them out loud, like a message from a supervisor.
              </Step>
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <SourceTag>AI: Google Gemini reads the photo, writes and speaks the message</SourceTag>
              <SourceTag tone="sand">{isSaved ? 'Demo day: Gemini’s answers were made once and saved' : 'Each answer is made once by Gemini, then shared'}</SourceTag>
            </div>
          </Card>

          {diff && <DiffCard diff={diff} />}
        </div>
      </div>
    </div>
  )
}

function GeminiMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="gm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8cff" />
          <stop offset="1" stopColor="#a970ff" />
        </linearGradient>
      </defs>
      <path d="M12 2c.6 4.8 3.2 7.4 10 10-6.8 2.6-9.4 5.2-10 10-.6-4.8-3.2-7.4-10-10 6.8-2.6 9.4-5.2 10-10z" fill="url(#gm)" />
    </svg>
  )
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.kind === 'photo')
    return (
      <div className="rounded-[20px] rounded-br-md bg-teal-water p-1.5">
        <div className="relative overflow-hidden rounded-[15px]">
          <img src={msg.src} alt="Photo of the salt meter in well water" className="h-44 w-full object-cover" />
        </div>
      </div>
    )
  if (msg.kind === 'thinking')
    return (
      <div className="flex items-center gap-2 rounded-[20px] rounded-bl-md bg-white px-3.5 py-2.5 shadow-sm">
        <m.span animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }} className="flex">
          <GeminiMark />
        </m.span>
        <span className="gemini-shimmer text-[13px] font-semibold">{msg.label}</span>
      </div>
    )
  if (msg.kind === 'voice') {
    const L = LANGS.find((l) => l.id === msg.lang)!
    return (
      <div className="rounded-[20px] rounded-bl-md bg-white p-3 shadow-sm">
        <VoiceNote url={msg.url} browser={msg.browser} text={msg.text} lang={msg.lang} />
        <p dir={L.rtl ? 'rtl' : 'ltr'} lang={L.bcp47} className="mt-2 text-[14px] leading-relaxed text-ink">
          {msg.text}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-ink/65">
          <GeminiMark className="h-3 w-3" /> Written and voiced by Gemini
        </p>
      </div>
    )
  }
  return (
    <div
      className={`rounded-[20px] px-3.5 py-2.5 text-[14px] leading-snug ${msg.from === 'farmer' ? 'rounded-br-md bg-teal-water text-white' : 'rounded-bl-md bg-white text-ink shadow-sm'}`}
    >
      {msg.text}
    </div>
  )
}

function Replies({
  stage,
  onPhoto,
  onConfirm,
  onLang,
  onRestart,
}: {
  stage: Stage
  onPhoto: (s: (typeof SAMPLES)[number]) => void
  onConfirm: (yes: boolean) => void
  onLang: (l: Lang) => void
  onRestart: () => void
}) {
  const chip = 'min-h-11 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink shadow-sm ring-1 ring-black/5 hover:ring-teal-water'
  return (
    <div className="min-h-[124px] border-t border-black/5 bg-white/90 px-3 py-3">
      {stage === 'ask-photo' && (
        <>
          <p className="mb-2 text-[11px] font-semibold text-ink/65">Send a photo of the salt meter (example photos):</p>
          <div className="grid grid-cols-3 gap-2">
            {SAMPLES.map((s) => (
              <button key={s.id} onClick={() => onPhoto(s)} className="overflow-hidden rounded-xl ring-1 ring-black/10 transition-shadow hover:ring-2 hover:ring-teal-water">
                <img src={s.src} alt={`Example salt meter photo showing ${s.label}`} className="h-16 w-full object-cover" />
                <span className="block py-1 text-[11px] font-semibold">{s.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {stage === 'confirm' && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onConfirm(true)} className={`${chip} bg-teal-water text-white`}>
            Yes, that’s right
          </button>
          <button onClick={() => onConfirm(false)} className={chip}>
            No, send another
          </button>
        </div>
      )}
      {(stage === 'ask-lang' || stage === 'done') && (
        <>
          <p className="mb-2 text-[11px] font-semibold text-ink/65">
            {stage === 'done' ? 'Hear it in another language:' : 'Choose a language:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => onLang(l.id)} className={chip}>
                <span lang={l.bcp47}>{l.native}</span>
              </button>
            ))}
            {stage === 'done' && (
              <button onClick={onRestart} className={`${chip} text-teal-water`}>
                Start again
              </button>
            )}
          </div>
        </>
      )}
      {(stage === 'reading' || stage === 'generating') && (
        <p className="flex h-[96px] items-center justify-center gap-2 text-[13px] font-medium text-ink/65">
          <GeminiMark /> Gemini is working…
        </p>
      )}
    </div>
  )
}

function Step({ n, active, done, title, children }: { n: number; active: boolean; done: boolean; title: string; children: ReactNode }) {
  return (
    <li className={`flex gap-3.5 rounded-2xl p-3 transition-colors duration-500 ${active ? 'bg-teal-water/8 ring-1 ring-teal-water/25' : ''}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold transition-colors duration-500 ${done ? 'bg-teal-water text-white' : active ? 'bg-ink text-white' : 'bg-black/[0.06] text-ink/60'}`}
      >
        {done ? '✓' : n}
      </span>
      <div>
        <p className={`text-[16px] font-semibold ${active || done ? 'text-ink' : 'text-ink/65'}`}>{title}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink/70">{children}</p>
      </div>
    </li>
  )
}

function DiffCard({ diff }: { diff: { before: FarmPlan; after: FarmPlan; from: number; to: number } }) {
  return (
    <Card>
      <h2 className="text-[19px] font-semibold">How tomorrow’s plan changed</h2>
      <p className="mt-1 text-[14px] text-ink/70">
        Well water: {one(diff.from)} → {one(diff.to)} dS/m. Saltier water needs more extra water to wash the salt away from the
        roots.
      </p>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-[12px] text-ink/65">
          <tr>
            <th className="py-1 font-semibold">Valve</th>
            <th className="font-semibold">Minutes</th>
            <th className="font-semibold">Extra for salt</th>
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[52px] bg-[#2a2a2c] p-3 shadow-[0_40px_90px_-40px_rgba(10,111,105,0.6)] ring-1 ring-black/10">
      <div className="overflow-hidden rounded-[42px] bg-[#f2f2f7]">
        <div className="flex items-center justify-between px-7 pt-3.5 pb-1 text-[12px] font-semibold text-ink">
          <span className="tabular">18:30</span>
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
    <div className="flex items-center gap-3 border-b border-black/5 bg-white/90 px-4 py-3 text-ink">
      <img src="/favicon.svg" alt="" width={36} height={36} className="rounded-full" />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold">Namak · farm assistant</p>
        <p className="flex items-center gap-1 text-[12px] text-ink/65">
          <GeminiMark className="h-3 w-3" /> powered by Google Gemini
        </p>
      </div>
    </div>
  )
}

function bars(seed: string, n = 30) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0
    return 0.25 + (((h >>> 16) % 1000) / 1000) * 0.75 * (0.6 + 0.4 * Math.sin(i / 3))
  })
}

function VoiceNote({ url, browser, text, lang }: { url: string | null; browser: boolean; text: string; lang: Lang }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dur, setDur] = useState(0)
  const b = useMemo(() => bars(text), [text])

  useEffect(() => {
    if (!url) return
    const a = new Audio(url)
    audio.current = a
    a.onloadedmetadata = () => setDur(a.duration)
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0)
    a.onended = () => {
      setPlaying(false)
      setProgress(1)
    }
    a.play()
      .then(() => setPlaying(true))
      .catch(() => {})
    return () => a.pause()
  }, [url])

  const toggle = () => {
    if (!url) {
      if (!browser) return
      if (playing) {
        speechSynthesis.cancel()
        setPlaying(false)
      } else setPlaying(speakInBrowser(text, lang, () => setPlaying(false)))
      return
    }
    const a = audio.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else
      a.play()
        .then(() => setPlaying(true))
        .catch(() => {})
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={toggle}
        disabled={!url && !browser}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-water text-white disabled:opacity-40"
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden>
        {b.map((h, i) => (
          <span key={i} className={`w-[3px] rounded-full ${i / b.length <= progress ? 'bg-teal-water' : 'bg-teal-water/30'}`} style={{ height: `${h * 100}%` }} />
        ))}
      </div>
      <span className="w-9 text-right text-[11px] tabular text-ink/65">{dur ? `0:${String(Math.round(dur)).padStart(2, '0')}` : ''}</span>
    </div>
  )
}
