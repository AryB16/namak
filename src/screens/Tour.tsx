/**
 * First-visit story (apple.com-style scroll). Every number is computed by the engine from the bundled ERA5 year for
 * the illustrative demo farm — nothing is hard-coded.
 */
import { m, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { markToured } from '../lib/tour'
import { CountUp, EASE, Reveal } from '../components/motion'
import { DEMO_FARM } from '../data/demoFarm'
import era5 from '../data/snapshot-era5.json'
import { compareYear } from '../engine/farm'
import { replaySeason, type WeatherDay } from '../engine/plan'
import { LANGS } from '../lib/instruction'
import sampleVoice from '../data/sampleVoice.json'

type Story = ReturnType<typeof computeStory>

function computeStory() {
  const days = era5.days as WeatherDay[]
  const year = compareYear(DEMO_FARM, days)
  // Only the palm valve needs a day-by-day replay (for the pinned chart); the rest comes from compareYear.
  const pv = DEMO_FARM.valves.find((v) => v.cropId === 'date-palm')!
  const r = replaySeason(DEMO_FARM, pv, days)
  const palms = { v: pv, r }
  const over = (d: { eceEnd: number; target: number }[]) => d.filter((x) => x.eceEnd > x.target + 0.05).length
  const yTomato = year.valves.find((v) => v.valve.cropId === 'tomato')!
  return {
    saltM3: year.saltLitres / 1000,
    cropM3: (year.namakLitres - year.saltLitres) / 1000,
    // Same figures as the "Habit vs Namak" screen and the README (12 months of ERA5 weather).
    savedPct: (year.savedLitres / year.habitLitres) * 100,
    palms,
    palmHabitOver: over(r.habit),
    palmNamakOver: over(r.namak),
    palmPeakPct: (Math.max(...r.habit.map((d) => d.eceEnd)) / r.habit[0].target - 1) * 100,
    tomatoHabit: yTomato.habitYield,
    tomatoNamak: yTomato.namakYield,
    from: days.slice(-365)[0].date,
    to: days[days.length - 1].date,
  }
}

/** Compute the story after first paint so the hero appears instantly. */
function useStory(): Story | null {
  const [s, setS] = useState<Story | null>(null)
  useEffect(() => {
    const run = () => setS(computeStory())
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 1200 })
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
    }
    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [])
  return s
}

const monthYear = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function openFarm() {
  markToured()
  window.location.hash = 'tomorrow'
}

export default function Tour() {
  const s = useStory()
  return (
    <div className="bg-night text-white">
      <TourHeader />
      <Hero />
      {s ? (
        <>
          <HiddenCost saltM3={s.saltM3} cropM3={s.cropM3} />
          <DebtStory s={s} />
          <ValveSection />
          <Results s={s} />
          <Final from={s.from} to={s.to} />
        </>
      ) : (
        <div className="h-[100svh] bg-salt" />
      )}
    </div>
  )
}

function TourHeader() {
  const [tone, setTone] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('[data-tone]')]
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setTone((e.target as HTMLElement).dataset.tone as 'dark' | 'light')
      },
      { rootMargin: '0px 0px -94% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  const dark = tone === 'dark'
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b backdrop-blur-xl backdrop-saturate-150 transition-colors duration-500 ${dark ? 'border-white/10 bg-black/60 text-white' : 'border-black/[0.08] bg-[rgba(251,251,253,0.75)] text-ink'}`}
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

/* 1 — Hero */
function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.9])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const words = ['Your', 'well', 'is', 'salty.']
  return (
    <section ref={ref} data-tone="dark" className="relative flex h-[100svh] min-h-[560px] items-center justify-center overflow-hidden px-6">
      <m.div
        aria-hidden
        className="absolute top-1/2 left-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(95,211,198,0.35),rgba(95,211,198,0)_65%)]"
        animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <m.div style={{ scale, opacity }} className="relative text-center">
        <m.p
          className="text-[15px] font-semibold text-glow-salt md:text-[17px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          Namak · smarter watering for salty wells
        </m.p>
        <h1 className="mt-4 text-[56px] leading-[1] font-semibold tracking-[-0.04em] md:text-[112px]">
          {words.map((w, i) => (
            <m.span
              key={w}
              className="inline-block pr-[0.22em]"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.05 + i * 0.08 }}
            >
              {w}
            </m.span>
          ))}
        </h1>
        <m.p
          className="mx-auto mt-6 max-w-[560px] text-[19px] leading-snug text-white/70 md:text-[24px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}
        >
          Every litre of well water leaves a little salt in the soil. Namak works out how much water each crop really needs — and tells the farm worker, by voice.
        </m.p>
      </m.div>
      <m.div
        aria-hidden
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
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
    <section data-tone="light" className="bg-salt px-6 py-28 text-ink md:py-40">
      <div className="mx-auto max-w-[980px] text-center">
        <Reveal>
          <p className="text-[17px] font-semibold text-teal-water md:text-[21px]">Problem one</p>
          <h2 className="mt-3 text-[40px] leading-[1.05] font-semibold md:text-[64px]">Salt is the hidden water cost.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-14 text-[72px] leading-none font-semibold tracking-[-0.05em] text-teal-water tabular md:text-[148px]">
            <CountUp value={saltM3} duration={1.6} />
            <span className="ml-2 text-[0.35em] tracking-tight text-ink/65">m³</span>
          </p>
          <p className="mx-auto mt-5 max-w-[620px] text-[19px] leading-snug text-ink/70 md:text-[22px]">
            of water a year (1 m³ = 1,000 litres) — just to wash salt away from the roots, on one small farm near Al Ain. Farmers guess
            this number. Namak calculates it, every day.
          </p>
        </Reveal>
        <Reveal delay={0.15} className="mx-auto mt-16 max-w-[760px] text-left">
          <div className="flex h-14 w-full overflow-hidden rounded-2xl bg-sand-200">
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
      k: 'The habit',
      t: `Same ${s.palms.v.habitMinutes} minutes, every day.`,
      b: 'The worker’s summer setting, left on all year. In winter it floods the palms. In summer it can’t keep up — and the salt stays behind.',
    },
    {
      k: 'Problem two · Salt debt',
      t: 'By July, the debt comes due.',
      b: `Salt in the palm roots climbs to ${Math.round(s.palmPeakPct)}% over the limit. ${s.palmHabitOver} days of the year in the red.`,
    },
    {
      k: 'Namak',
      t: 'Pay it down on cool days.',
      b: `Just enough flush every night, extra on the week’s coolest days — as FAO-29 recommends. ${s.palmNamakOver} day over the limit.`,
    },
  ]

  return (
    <section ref={ref} data-tone="light" className="relative h-[320vh] bg-sand-100 text-ink">
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
          <div className="rounded-[28px] bg-salt p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] md:p-7">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-semibold text-ink/70">Root-zone salt · date palms</p>
              <p className="text-[12px] text-ink/65">dS/m · ERA5 weather</p>
            </div>
            <svg viewBox={`0 0 ${W} ${H + 24}`} className="mt-4 w-full" role="img" aria-label="Root-zone salt over a year: habit rises above the limit in summer; Namak stays at the limit">
              <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="#c0362c" strokeDasharray="6 6" strokeWidth={1.5} />
              <text x={W * 0.36} y={y(target) - 12} textAnchor="middle" fontSize="13" fill="#c0362c" fontWeight="600">
                palm salt limit {target.toFixed(1)} dS/m
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
  const texts = sampleVoice.texts as Record<string, string>
  return (
    <section ref={ref} data-tone="dark" className="overflow-hidden bg-night px-6 py-28 md:py-40">
      <div className="mx-auto grid max-w-[1080px] items-center gap-14 md:grid-cols-2">
        <div>
          <Reveal>
            <p className="text-[17px] font-semibold text-glow-salt">Problem three</p>
            <h2 className="mt-3 text-[40px] leading-[1.05] font-semibold md:text-[60px]">The decision-maker isn’t at the valve.</h2>
            <p className="mt-6 max-w-[460px] text-[19px] leading-snug text-white/70">
              The owner decides. A hired worker opens the valves — often by habit, often in another language. Namak sends tomorrow’s
              exact minutes as a voice note in theirs.
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
              The worker closes the loop with a photo of a <strong className="text-white">~AED 100 EC pen</strong>. AI reads the
              display, the owner confirms, and tomorrow’s plan updates.
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
    { big: <CountUp value={s.savedPct} format={(n) => `${Math.round(n)}%`} />, label: 'less water across the farm than the worker’s habit', tone: 'text-teal-water' },
    {
      big: (
        <>
          <CountUp value={s.palmHabitOver} /> → <CountUp value={s.palmNamakOver} />
        </>
      ),
      label: 'days the palms spent over their salt limit',
      tone: 'text-[#9a5d12]',
    },
    {
      big: (
        <>
          <CountUp value={s.tomatoHabit} format={(n) => `${Math.round(n)}%`} /> → <CountUp value={s.tomatoNamak} format={(n) => `${Math.round(n)}%`} />
        </>
      ),
      label: 'tomato yield, habit → Namak',
      tone: 'text-green-ok',
    },
    { big: <>AED 100</>, label: 'the only hardware: an EC pen. No sensors, no subscription.', tone: 'text-ink' },
  ]
  return (
    <section data-tone="light" className="bg-salt px-6 py-28 text-ink md:py-40">
      <div className="mx-auto max-w-[1080px]">
        <Reveal className="text-center">
          <p className="text-[17px] font-semibold text-teal-water md:text-[21px]">Does it beat the guess?</p>
          <h2 className="mt-3 text-[40px] leading-[1.05] font-semibold md:text-[64px]">A real year, replayed.</h2>
          <p className="mx-auto mt-4 max-w-[600px] text-[19px] text-ink/70">
            The same farm, the same well, the same 365 days of real weather. The worker’s habit versus Namak, day by day.
          </p>
        </Reveal>
        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {tiles.map((t, i) => (
            <Reveal key={t.label} delay={i * 0.08} className="rounded-[28px] bg-sand-100 p-8 md:p-10">
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
          Science: FAO Irrigation & Drainage Papers 29, 56 and 61. Works offline · English, العربية, हिन्दी, اردو, മലയാളം.
        </p>
      </Reveal>
    </section>
  )
}
