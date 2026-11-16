/**
 * First-visit story (apple.com-style scroll). Every number is computed by the engine from the bundled ERA5 year for
 * the illustrative demo farm — nothing is hard-coded.
 */
import { m, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { markToured } from '../lib/tour'
import { useDemo } from '../demo/Demo'
import { CountUp, EASE, Reveal } from '../components/motion'
import { LANGS } from '../lib/instruction'
import type { Story } from '../lib/story'
import demoAssets from '../data/demoAssets.json'
import SaltBasics from '../components/SaltBasics'
import SaltField from '../components/SaltField'

/** Compute the story off the main thread (Web Worker) so the first screen never stalls. */
function useStory(): Story | null {
  const [s, setS] = useState<Story | null>(null)
  useEffect(() => {
    let w: Worker | null = null
    try {
      w = new Worker(new URL('../lib/story.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<Story>) => setS(e.data)
      w.onerror = () => import('../lib/story').then((m) => setS(m.computeStory()))
    } catch {
      import('../lib/story').then((m) => setS(m.computeStory()))
    }
    return () => w?.terminate()
  }, [])
  return s
}

const monthYear = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function openFarm() {
  markToured()
  window.location.hash = 'tomorrow'
}

/** Below-the-fold sections are heavy to lay out; build them when the reader starts scrolling (or after a few idle seconds). */
function useWantsMore(): boolean {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const on = () => setGo(true)
    const evs = ['scroll', 'wheel', 'touchstart', 'keydown'] as const
    evs.forEach((e) => window.addEventListener(e, on, { once: true, passive: true }))
    const t = setTimeout(on, 4000)
    return () => {
      clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, on))
    }
  }, [])
  return go
}

export default function Tour() {
  const story = useStory()
  const s = useWantsMore() ? story : null
  return (
    <div className="bg-night text-white">
      <TourHeader ready={!!s} />
      <Hero />
      {s ? (
        <>
          <Fade from="night" to="dune" />
          <SaltBasics />
          <HiddenCost saltM3={s.saltM3} cropM3={s.cropM3} />
          <DebtStory s={s} />
          <Fade from="dune" to="night" />
          <ValveSection />
          <Fade from="night" to="dune" />
          <Results s={s} />
          <Fade from="dune" to="night" />
          <Final from={s.from} to={s.to} />
        </>
      ) : (
        <div className="h-[100svh] bg-gradient-to-b from-night to-dune" />
      )}
    </div>
  )
}

function TourHeader({ ready }: { ready: boolean }) {
  const [tone, setTone] = useState<'dark' | 'light'>('dark')
  // Match the header to whatever is directly under it (works for pinned sections and the gradient bands).
  useEffect(() => {
    let raf = 0
    const check = () => {
      raf = 0
      const el = document.elementFromPoint(window.innerWidth / 2, 56)?.closest<HTMLElement>('[data-tone]')
      if (el) setTone(el.dataset.tone as 'dark' | 'light')
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', on, { passive: true })
    return () => {
      window.removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [ready])
  const dark = tone === 'dark'
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b backdrop-blur-xl backdrop-saturate-150 transition-colors duration-500 ${dark ? 'border-white/10 bg-black/60 text-white' : 'border-black/[0.08] bg-[rgba(241,232,218,0.8)] text-ink'}`}
    >
      <div className="mx-auto flex h-12 max-w-[1080px] items-center justify-between px-4 md:px-6">
        <span className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" width={22} height={22} className="rounded-[6px]" />
          <span className="text-[15px] font-semibold">Namak</span>
        </span>
        <button onClick={openFarm} className={`min-h-11 rounded-full px-3 text-[13px] font-medium ${dark ? 'text-white/80 hover:text-white' : 'text-ink/70 hover:text-ink'}`}>
          Skip to the farm →
        </button>
      </div>
    </header>
  )
}

/** A soft gradient band between dark and light sections, so the page never flips from black to light in one line. */
function Fade({ from, to }: { from: 'night' | 'dune'; to: 'night' | 'dune' }) {
  const c = { night: '#000000', dune: '#f1e8da' }
  const tone = (k: 'night' | 'dune') => (k === 'night' ? 'dark' : 'light')
  return (
    <div aria-hidden className="flex h-40 flex-col md:h-56" style={{ background: `linear-gradient(${c[from]}, #3d342b 45%, ${c[to]})` }}>
      <div data-tone={tone(from)} className="flex-1" />
      <div data-tone={tone(to)} className="flex-1" />
    </div>
  )
}

/* 1 — Hero: drifting salt crystals that scatter from the cursor, a water-light that follows it, a title that tilts toward it */
function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.9])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const demo = useDemo()

  // Pointer position, normalised to -0.5..0.5 across the section (0 = centre).
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 90, damping: 18, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 90, damping: 18, mass: 0.6 })
  const lightX = useTransform(sx, (v) => `${50 + v * 100}%`)
  const lightY = useTransform(sy, (v) => `${50 + v * 100}%`)
  const rotY = useTransform(sx, [-0.5, 0.5], [7, -7])
  const rotX = useTransform(sy, [-0.5, 0.5], [-5, 5])
  const shiftX = useTransform(sx, [-0.5, 0.5], [14, -14])
  const shiftY = useTransform(sy, [-0.5, 0.5], [10, -10])
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const r = ref.current!.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onLeave = () => {
    px.set(0)
    py.set(0)
  }

  const words = ['Your', 'well', 'is']
  return (
    <section
      ref={ref}
      data-tone="dark"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative flex h-[100svh] min-h-[560px] items-center justify-center overflow-hidden px-6"
    >
      {/* water-light that follows the cursor */}
      <m.div
        aria-hidden
        className="pointer-events-none absolute h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(95,211,198,0.30),rgba(95,211,198,0.08)_40%,rgba(95,211,198,0)_68%)]"
        style={{ left: lightX, top: lightY }}
      />
      <m.div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,181,71,0.10),rgba(255,181,71,0)_65%)]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <SaltField />

      <m.div style={{ scale, opacity }} className="relative text-center [perspective:900px]">
        <m.div style={{ rotateX: rotX, rotateY: rotY, x: shiftX, y: shiftY }} className="[transform-style:preserve-3d]">
          <h1 className="text-[64px] leading-[0.95] font-semibold tracking-[-0.045em] md:text-[132px]">
            {words.map((w, i) => (
              <m.span
                key={w}
                className="inline-block pr-[0.22em]"
                initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1, ease: EASE, delay: 0.05 + i * 0.09 }}
              >
                {w}
              </m.span>
            ))}
            <m.span
              className="salt-shine inline-block"
              initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1, ease: EASE, delay: 0.32 }}
            >
              salty.
            </m.span>
          </h1>
        </m.div>
        <m.p
          className="mx-auto mt-7 max-w-[640px] text-[19px] leading-snug text-white/65 md:text-[23px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
        >
          Namak tells you exactly how much to water — salt included.
        </m.p>
        <m.div
          className="mx-auto mt-10 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.75 }}
        >
          <m.button
            onClick={demo.start}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="group relative flex min-h-14 items-center justify-center gap-3 overflow-hidden rounded-full bg-white px-7 text-[17px] font-semibold text-ink shadow-[0_12px_50px_-12px_rgba(95,211,198,0.8)]"
          >
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-teal-water text-[11px] text-white">
              <span className="absolute inset-0 animate-ping rounded-full bg-teal-water/40" />▶
            </span>
            Watch the demo <span className="font-normal text-ink/70">· 60 s</span>
          </m.button>
          <m.button
            onClick={openFarm}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="min-h-14 rounded-full bg-white/[0.08] px-7 text-[17px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/15"
          >
            Explore on my own
          </m.button>
        </m.div>
      </m.div>
      <m.div
        aria-hidden
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[12px] font-medium text-white/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{ opacity: { delay: 1.4, duration: 0.8 }, y: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
      >
        Scroll for the story
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </m.div>
    </section>
  )
}

/* 2 — Salt is the hidden water cost */
function HiddenCost({ saltM3, cropM3 }: { saltM3: number; cropM3: number }) {
  const total = saltM3 + cropM3
  return (
    <section data-tone="light" className="bg-dune px-6 py-28 text-ink md:py-40">
      <div className="mx-auto max-w-[980px] text-center">
        <Reveal>
          <p className="text-[17px] font-semibold text-teal-water md:text-[21px]">Problem 1 · the hidden water cost</p>
          <h2 className="mt-3 text-[40px] leading-[1.05] font-semibold md:text-[64px]">So part of every watering is just for salt.</h2>
          <p className="mx-auto mt-4 max-w-[600px] text-[19px] leading-snug text-ink/70 md:text-[21px]">On one small example farm near Al Ain, that extra water adds up to:</p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-10 text-[72px] leading-none font-semibold tracking-[-0.05em] text-teal-water tabular md:text-[148px]">
            <CountUp value={saltM3} duration={1.6} />
            <span className="ml-2 text-[0.35em] tracking-tight text-ink/65">m³</span>
          </p>
          <p className="mx-auto mt-5 max-w-[620px] text-[19px] leading-snug text-ink/70 md:text-[22px]">
            of water a year (1 m³ = 1,000 litres), used only to wash salt down past the roots. Most farms never measure this — they
            guess. Namak calculates it for each crop, every day.
          </p>
        </Reveal>
        <Reveal delay={0.15} className="mx-auto mt-16 max-w-[760px] text-left">
          <div className="flex h-14 w-full overflow-hidden rounded-2xl bg-dune-2">
            <m.div
              className="flex items-center bg-teal-water px-4 text-[13px] font-semibold text-white"
              initial={{ width: 0 }}
              whileInView={{ width: `${(cropM3 / total) * 100}%` }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.2, ease: EASE }}
            >
              <span className="whitespace-nowrap">For the crop</span>
            </m.div>
            <m.div
              className="flex items-center justify-center bg-amber-warn text-[13px] font-semibold text-ink"
              initial={{ width: 0 }}
              whileInView={{ width: `${(saltM3 / total) * 100}%` }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.5 }}
            >
              <span className="whitespace-nowrap">Salt</span>
            </m.div>
          </div>
          <p className="mt-3 text-[13px] text-ink/65">
            A year of water on the example farm: {Math.round(cropM3).toLocaleString('en-US')} m³ for the plants to drink + {Math.round(saltM3).toLocaleString('en-US')} m³
            just to wash salt away. Real weather · UN FAO method.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* 3 — Pinned: the salt debt builds up, then Namak pays it down */
function DebtStory({ s }: { s: Story }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const habitLen = useTransform(scrollYProgress, [0.05, 0.6], [0, 1])
  const namakLen = useTransform(scrollYProgress, [0.62, 0.95], [0, 1])
  const namakOpacity = useTransform(scrollYProgress, [0.6, 0.66], [0, 1])
  const [step, setStep] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setStep(v < 0.33 ? 0 : v < 0.62 ? 1 : 2))

  const { habit, namak } = s.palms.r
  const W = 600
  const H = 300
  const maxY = Math.max(...habit.map((d) => d.eceEnd), 6) * 1.1
  const x = (i: number) => (i / (habit.length - 1)) * W
  const y = (v: number) => H - (v / maxY) * H
  const path = (arr: { eceEnd: number }[]) => arr.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.eceEnd).toFixed(1)}`).join(' ')
  const target = habit[0].target
  const months = habit.filter((d) => d.date.endsWith('-01')).map((d) => ({ i: habit.indexOf(d), m: new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) }))

  const steps = [
    {
      k: 'Problem 2 · salt debt',
      t: 'The habit: the same minutes, every day.',
      b: `Most farms water by habit. Here the worker gives the palms ${s.palms.v.habitMinutes} minutes a day, all year. In winter that is far more than palms drink. In summer it is not enough to wash the salt down.`,
    },
    {
      k: 'Problem 2 · salt debt',
      t: 'Salt builds up like a debt.',
      b: `Every watering leaves a little salt — like borrowing. Every extra wash pays some back. With the habit the debt grows all summer: the soil ends up ${Math.round(s.palmPeakPct)}% saltier than palms can take, and stays over the safe line for ${s.palmHabitOver} days.`,
    },
    {
      k: 'Namak',
      t: 'Namak pays the debt back on cool days.',
      b: `It adds just enough extra water each day, and saves the bigger washes for the coolest days, when plants drink least. The soil went over the safe line on only ${s.palmNamakOver} ${s.palmNamakOver === 1 ? 'day' : 'days'}.`,
    },
  ]

  return (
    <section ref={ref} data-tone="light" className="relative h-[320vh] bg-dune text-ink">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden px-6">
        <div className="mx-auto grid w-full max-w-[1080px] items-center gap-10 md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[220px]">
            {steps.map((st, i) => (
              <m.div
                key={st.k}
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: step === i ? 1 : 0, y: step === i ? 0 : step > i ? -24 : 24 }}
                transition={{ duration: 0.6, ease: EASE }}
                aria-hidden={step !== i}
              >
                <p className={`text-[15px] font-semibold ${i === 2 ? 'text-teal-water' : 'text-[#9a5d12]'}`}>{st.k}</p>
                <h2 className="mt-2 text-[36px] leading-[1.05] font-semibold md:text-[52px]">{st.t}</h2>
                <p className="mt-4 max-w-[440px] text-[17px] leading-snug text-ink/70 md:text-[19px]">{st.b}</p>
              </m.div>
            ))}
          </div>
          <div className="rounded-[28px] bg-dune-card p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] md:p-7">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-semibold text-ink/70">Salt in the soil around the palm roots</p>
              <p className="text-[12px] text-ink/65">dS/m · ERA5 weather</p>
            </div>
            <svg viewBox={`0 0 ${W} ${H + 24}`} className="mt-4 w-full" role="img" aria-label="Root-zone salt over a year: habit rises above the limit in summer; Namak stays at the limit">
              <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="#c0362c" strokeDasharray="6 6" strokeWidth={1.5} />
              <text x={W * 0.36} y={y(target) - 12} textAnchor="middle" fontSize="13" fill="#c0362c" fontWeight="600">
                safe level for palms ({target.toFixed(1)})
              </text>
              <m.path d={path(habit)} fill="none" stroke="#e08a1e" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: habitLen }} />
              <m.path d={path(namak)} fill="none" stroke="#0a6f69" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: namakLen, opacity: namakOpacity }} />
              {months.filter((_, i) => i % 2 === 0).map((m) => (
                <text key={m.i} x={x(m.i)} y={H + 20} fontSize="12" fill="#6e6e73">
                  {m.m}
                </text>
              ))}
            </svg>
            <div className="mt-3 flex gap-5 text-[13px] font-semibold">
              <span className="flex items-center gap-2">
                <span className="h-1 w-5 rounded-full bg-amber-warn" /> Habit
              </span>
              <m.span className="flex items-center gap-2" style={{ opacity: namakOpacity }}>
                <span className="h-1 w-5 rounded-full bg-teal-water" /> Namak
              </m.span>
            </div>
            <p className="mt-3 text-[13px] leading-snug text-ink/65">
              How salty the soil around the palm roots gets, through one real year of weather. Above the red line, palms start to lose harvest.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* 4 — The decision-maker isn't at the valve */
function ValveSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const phoneY = useTransform(scrollYProgress, [0, 1], [120, -80])
  const phoneRot = useTransform(scrollYProgress, [0, 0.5], [-6, 0])
  const texts = Object.fromEntries(Object.entries(demoAssets.byReading['ec-3.82-mscm'].voice).map(([k, v]) => [k, v.text])) as Record<string, string>
  return (
    <section ref={ref} data-tone="dark" className="overflow-hidden bg-night px-6 py-28 md:py-40">
      <div className="mx-auto grid max-w-[1080px] items-center gap-14 md:grid-cols-2">
        <div className="min-w-0">
          <Reveal>
            <p className="text-[17px] font-semibold text-glow-salt">Problem 3 · the person at the tap</p>
            <h2 className="mt-3 text-[40px] leading-[1.05] font-semibold md:text-[60px]">The person with the plan isn’t the one at the tap.</h2>
            <p className="mt-6 max-w-[460px] text-[19px] leading-snug text-white/70">
              The owner makes the plan, but a hired worker opens the valves — usually the same minutes every day, and often in a
              language the owner doesn’t speak. Namak turns tomorrow’s plan into a short voice note in the worker’s own language.
            </p>
          </Reveal>
          <div className="mt-10 space-y-3">
            {LANGS.map((l, i) => (
              <Reveal key={l.id} delay={0.08 * i} y={16}>
                <p className="flex items-baseline gap-3">
                  <span className="w-20 shrink-0 text-[12px] font-semibold text-white/65">{l.name}</span>
                  <span dir={l.rtl ? 'rtl' : 'ltr'} lang={l.bcp47} className="min-w-0 flex-1 truncate text-left text-[17px] text-white/80 md:text-[19px]">
                    {texts[l.id]?.split(/[.।۔]/)[0]}
                  </span>
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2} className="mt-12 flex items-center gap-5">
            <img src="/samples/ec-3.82-mscm.svg" alt="An EC pen display reading 3.82 mS/cm" className="h-28 w-20 rounded-xl object-cover" />
            <p className="max-w-[340px] text-[17px] leading-snug text-white/70">
              To check the salt, the worker photographs a cheap salt meter — a <strong className="text-white">~AED 100 EC pen</strong>.
              AI reads the number, the owner confirms, and tomorrow’s plan adjusts.
            </p>
          </Reveal>
        </div>
        <m.div style={{ y: phoneY, rotate: phoneRot }} className="mx-auto w-[300px] md:w-[330px]">
          <div className="rounded-[48px] bg-[#2a2a2c] p-3 shadow-[0_40px_120px_-30px_rgba(95,211,198,0.45)] ring-1 ring-white/10">
            <div className="overflow-hidden rounded-[38px] bg-[#f2f2f7] text-ink">
              <div className="flex items-center justify-center pt-3 pb-2">
                <span className="h-6 w-24 rounded-full bg-black" />
              </div>
              <div className="flex items-center gap-3 border-b border-black/5 bg-white/80 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-glow-salt text-[15px] font-semibold">W</span>
                <span>
                  <span className="block text-[15px] font-semibold">Farm worker</span>
                  <span className="block text-[12px] text-ink/65">voice note · Hindi</span>
                </span>
              </div>
              <div className="space-y-3 px-3 py-5">
                <div className="ml-auto w-[88%] rounded-[20px] rounded-br-md bg-teal-water p-3 text-white">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">▶</span>
                    <div className="flex h-7 flex-1 items-center gap-[3px]">
                      {Array.from({ length: 22 }, (_, i) => (
                        <m.span
                          key={i}
                          className="w-[3px] rounded-full bg-white/80"
                          initial={{ height: '20%' }}
                          whileInView={{ height: `${25 + ((i * 37) % 70)}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, ease: EASE, delay: 0.3 + i * 0.03 }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-white/75">0:30</span>
                  </div>
                  <p lang="hi-IN" className="mt-2 text-[14px] leading-snug">{texts.hi}</p>
                </div>
                <div className="w-[60%] rounded-[20px] rounded-bl-md bg-white p-2 shadow-sm">
                  <img src="/samples/ec-3.82-mscm.svg" alt="" className="h-28 w-full rounded-[14px] object-cover" />
                  <p className="px-1 pt-1.5 text-[12px] font-semibold text-teal-water">Read: 3.82 mS/cm</p>
                </div>
              </div>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  )
}

/* 5 — Results */
function Results({ s }: { s: Story }) {
  const tiles: { big: ReactNode; label: string; tone: string }[] = [
    { big: <CountUp value={s.savedPct} format={(n) => `${Math.round(n)}%`} />, label: 'less water across the whole farm than the habit', tone: 'text-teal-water' },
    {
      big: (
        <>
          <CountUp value={s.palmHabitOver} /> → <CountUp value={s.palmNamakOver} />
        </>
      ),
      label: 'days the palms’ soil was too salty, habit → Namak',
      tone: 'text-[#9a5d12]',
    },
    {
      big: (
        <>
          <CountUp value={s.tomatoHabit} format={(n) => `${Math.round(n)}%`} /> → <CountUp value={s.tomatoNamak} format={(n) => `${Math.round(n)}%`} />
        </>
      ),
      label: 'tomato harvest, habit → Namak (100% = no salt damage)',
      tone: 'text-green-ok',
    },
    { big: <>AED 100</>, label: 'the only hardware: an EC pen. No sensors, no subscription.', tone: 'text-ink' },
  ]
  return (
    <section data-tone="light" className="bg-dune px-6 py-28 text-ink md:py-40">
      <div className="mx-auto max-w-[1080px]">
        <Reveal className="text-center">
          <p className="text-[17px] font-semibold text-teal-water md:text-[21px]">Does it beat the guess?</p>
          <h2 className="mt-3 text-[40px] leading-[1.05] font-semibold md:text-[64px]">A real year, replayed.</h2>
          <p className="mx-auto mt-4 max-w-[600px] text-[19px] text-ink/70">
            We replayed the same farm and the same well through 365 days of real weather — once with the worker’s habit, once with Namak.
          </p>
        </Reveal>
        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {tiles.map((t, i) => (
            <Reveal key={t.label} delay={i * 0.08} className="rounded-[28px] bg-dune-card p-8 md:p-10">
              <p className={`text-[56px] leading-none font-semibold tracking-[-0.04em] tabular md:text-[80px] ${t.tone}`}>{t.big}</p>
              <p className="mt-4 max-w-[360px] text-[17px] leading-snug text-ink/70">{t.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* 6 — Final call to action */
function Final({ from, to }: { from: string; to: string }) {
  return (
    <section data-tone="dark" className="relative overflow-hidden bg-night px-6 py-32 text-center md:py-44">
      <div aria-hidden className="absolute inset-x-0 -bottom-40 mx-auto h-80 w-[80%] rounded-full bg-[radial-gradient(ellipse,rgba(95,211,198,0.28),transparent_70%)]" />
      <Reveal className="relative">
        <h2 className="text-[44px] leading-[1.02] font-semibold md:text-[80px]">
          Pay the salt debt.
          <br />
          <span className="text-white/55">Not the water bill.</span>
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <m.button
            onClick={openFarm}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="min-h-12 rounded-full bg-white px-7 text-[17px] font-semibold text-ink shadow-[0_10px_40px_-10px_rgba(95,211,198,0.7)]"
          >
            Open the demo farm
          </m.button>
          <a href="#why" onClick={markToured} className="min-h-12 rounded-full px-5 py-3 text-[17px] font-semibold text-glow-water">
            Why it works ›
          </a>
        </div>
        <p className="mx-auto mt-10 max-w-[560px] text-[13px] leading-relaxed text-white/65">
          Illustrative farm near Al Ain. Real weather: Open-Meteo forecast and ERA5 reanalysis ({monthYear(from)} – {monthYear(to)}).
          Science: FAO Irrigation & Drainage Papers 29, 56 and 61. Works offline · English, हिन्दी, العربية.
        </p>
      </Reveal>
    </section>
  )
}
