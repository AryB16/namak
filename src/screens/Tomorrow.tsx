import { m } from 'motion/react'
import { useMemo, useState } from 'react'
import { Button, Card, SaltGauge, SourceTag } from '../components/ui'
import { IconSend } from '../components/icons'
import { CountUp, EASE, Reveal, Stagger, StaggerItem } from '../components/motion'
import { Details, HowItWorks, Term } from '../components/explain'
import Tilt from '../components/Tilt'
import { CROPS } from '../engine/crops'
import { planFarm, type ValvePlan } from '../engine/farm'
import type { ValveSchedule, WeatherDay } from '../engine/plan'
import { dayLabel, int, litres, minutes, one, pct, weekday } from '../lib/format'
import { useApp } from '../state'

const VALVE_COLORS = ['#0a6f69', '#5fb8ad', '#7cc4ff', '#9b8cff', '#f2a65a']

export default function Tomorrow() {
  const { farm, planDays, forecast, online } = useApp()
  const plan = useMemo(() => (planDays.length ? planFarm(farm, planDays) : null), [farm, planDays])

  if (!plan) return <SkeletonTomorrow />

  const day0 = plan.days[0]
  const totalMin = plan.valves.reduce((a, v) => a + (v.days[0]?.minutes ?? 0), 0)
  const habitMin = plan.valves.reduce((a, v) => a + (v.habit[0]?.minutes ?? 0), 0)
  const namakL = plan.valves.reduce((a, v) => a + (v.days[0]?.litres ?? 0), 0)
  const habitL = plan.valves.reduce((a, v) => a + (v.habit[0]?.litres ?? 0), 0)
  const saved = habitL - namakL
  const first = plan.schedule[0]
  const last = plan.schedule[plan.schedule.length - 1]
  const sunrise = day0.sunrise ?? '06:15'
  const anyDebt = plan.valves.some((v) => v.eceNow > v.target + 0.01)
  const live = online && forecast?.source === 'live'

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-ink/65">{dayLabel(day0.date, 'long')} · demo farm near Al Ain</p>
          <h1 className="text-[40px] leading-[1.05] font-semibold md:text-[56px]">Tomorrow’s watering plan</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <SourceTag>{live ? 'Live weather forecast' : 'Saved weather forecast'}</SourceTag>
          <SourceTag tone="sand">Example farm</SourceTag>
        </div>
      </div>

      <HowItWorks />

      <div>
        <section data-demo="hero" className="relative overflow-hidden rounded-[32px] bg-night p-6 text-white md:p-10">
          <div
            aria-hidden
            className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(95,211,198,0.32),transparent_65%)]"
          />
          <div className="relative grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-end">
            <div>
              <p className="text-[15px] font-semibold text-glow-water">Total watering time tomorrow</p>
              <p className="mt-2 text-[64px] leading-[0.95] font-semibold tracking-[-0.045em] tabular [text-shadow:0_0_40px_rgba(95,211,198,0.35)] md:text-[96px]">
                <CountUp value={totalMin} format={(n) => minutes(n)} duration={1.2} />
              </p>
              <p className="mt-3 text-[17px] text-white/70">
                {plan.valves.length} <Term k="valve" dark>valves</Term>, one after another, from {first?.start} to {last?.end}
                {last && last.end <= sunrise ? ` — finished before sunrise (${sunrise}).` : `. Sunrise is ${sunrise}.`}
              </p>
              <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-white/80">
                The well on this farm is salty. Every time the crops are watered, a little salt stays behind in the soil — we
                call it the <Term k="salt debt" dark><span className="font-semibold text-glow-salt">salt debt</span></Term>. Namak
                adds just enough extra water to wash it away
                {anyDebt ? ', and does the bigger wash on this week’s coolest days.' : '.'}
              </p>
              <a
                href="#worker"
                className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-[16px] font-semibold text-ink shadow-[0_10px_40px_-12px_rgba(95,211,198,0.8)] transition-transform hover:scale-[1.03]"
              >
                <IconSend className="h-4 w-4" /> Send to the farm worker
              </a>
            </div>

            <div className="rounded-[24px] bg-white/[0.06] p-5 ring-1 ring-white/10 md:p-6">
              <p className="mb-4 text-[13px] text-white/60">Compared with what the worker usually does</p>
              <CompareBar label="Usual habit (same every day)" min={habitMin} l={habitL} max={Math.max(habitMin, totalMin)} tone="habit" />
              <CompareBar label="Namak’s plan" min={totalMin} l={namakL} max={Math.max(habitMin, totalMin)} tone="namak" />
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-[13px] font-medium text-white/60">{saved >= 0 ? 'Water saved tomorrow' : 'Extra water tomorrow'}</p>
                <p className="mt-1 text-[40px] leading-none font-semibold tracking-[-0.03em] text-glow-water tabular">
                  <CountUp value={Math.abs(saved)} format={(n) => `${int(n)} L`} />
                </p>
                <p className="mt-1 text-[13px] text-white/60">
                  {saved >= 0
                    ? `About ${int(Math.abs(saved) / 20)} jerry cans of 20 L · ≈ AED ${int((Math.abs(saved) / 1000) * farm.waterCostAedM3)}`
                    : 'Spent to wash salt away from the roots'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div>
        <h2 className="mb-1 text-[28px] font-semibold md:text-[32px]">Each valve, tomorrow</h2>
        <p className="mb-4 text-[15px] text-ink/70">Exact minutes, start time, and how salty that patch of soil is right now.</p>
        <div data-demo="valves">
          <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plan.valves.map((vp) => (
              <StaggerItem key={vp.valve.id}>
                <ValveCard vp={vp} slot={plan.schedule.find((s) => s.valveId === vp.valve.id)} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>

      <Reveal>
        <WeekChart valves={plan.valves} weather={plan.days} live={live} />
      </Reveal>
    </div>
  )
}

function CompareBar({ label, min, l, max, tone }: { label: string; min: number; l: number; max: number; tone: 'habit' | 'namak' }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className={tone === 'namak' ? 'font-semibold text-white' : 'text-white/65'}>{label}</span>
        <span className="shrink-0 tabular text-white/70">
          {minutes(min)} · {litres(l)}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
        <m.div
          className={`h-full rounded-full ${tone === 'namak' ? 'bg-glow-water' : 'bg-white/40'}`}
          initial={{ width: 0 }}
          animate={{ width: `${(min / max) * 100}%` }}
          transition={{ duration: 1.1, ease: EASE, delay: tone === 'namak' ? 0.25 : 0.1 }}
        />
      </div>
    </div>
  )
}

function cropLabel(id: string) {
  const c = CROPS[id as keyof typeof CROPS]
  return c.short === 'Fodder' ? 'Animal fodder grass' : c.short === 'Palms' ? 'Date palms' : c.name
}

function ValveCard({ vp, slot }: { vp: ValvePlan; slot?: ValveSchedule }) {
  const crop = CROPS[vp.valve.cropId]
  const d = vp.days[0]
  const h = vp.habit[0]
  const flushPct = d.lr / (1 - d.lr)
  const repayMin = d.isRepaymentDay ? (d.repaymentMm / d.grossMm) * d.minutes : 0
  return (
    <Tilt className="h-full">
      <Card className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink/65">{vp.valve.name}</p>
            <p className="text-[21px] font-semibold">{cropLabel(vp.valve.cropId)}</p>
          </div>
          {d.isRepaymentDay && (
            <span className="rounded-full bg-amber-warn/15 px-2.5 py-1 text-[12px] font-semibold text-[#8a5413]">Salt wash day</span>
          )}
        </div>
        <p className="mt-4 text-[56px] leading-none font-semibold tracking-[-0.04em] text-teal-water tabular">
          <CountUp value={d.minutes} />
          <span className="ml-1.5 text-[17px] font-semibold tracking-normal text-ink/65">minutes</span>
        </p>
        <p className="mt-2 text-[15px] font-medium tabular text-ink/80">
          Open {slot?.start} · close {slot?.end}
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink/75">
          The plants need about <strong className="text-ink">{one(d.etc)} litres per square metre</strong> tomorrow, plus{' '}
          <strong className="text-ink">{pct(flushPct)}</strong> extra to <Term k="wash out">wash out salt</Term>
          {d.isRepaymentDay && (
            <>
              , plus <strong className="text-ink">{Math.round(repayMin)} min</strong> to pay down the salt debt on a cool day
            </>
          )}
          . The usual habit is {Math.round(h.minutes)} min.
        </p>
        {vp.blend.needed && (
          <p className="mt-3 rounded-2xl bg-amber-warn/10 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">
            The well water is too salty for {crop.name.toLowerCase()} on its own. Mix in <strong>{pct(vp.blend.cleanFraction)} clean
            (desalinated) water</strong> on this line.
          </p>
        )}
        <div className="mt-auto pt-5">
          <SaltGauge ece={vp.eceNow} crop={crop} target={vp.target} />
        </div>
        <Details summary="How we worked this out">
          Crop water = heat of the day (reference evaporation ET₀ {one(d.et0)} mm, from the forecast) × crop factor Kc {d.kc.toFixed(2)} (UN
          FAO-56) = {one(d.etc)} mm. Salt wash: {pct(d.lr)} of the water must drain past the roots to keep soil salt at the crop’s safe
          level with {one(vp.ecApplied)} dS/m water (FAO-29). Total ÷ drip flow ({int(vp.valve.emitters)} drippers × {vp.valve.emitterLph} L/h) =
          minutes. Water: {litres(d.litres)}.
        </Details>
      </Card>
    </Tilt>
  )
}

/** 7-day plan as a stacked bar chart (minutes per valve per day); salt-wash days glow amber. */
function WeekChart({ valves, weather, live }: { valves: ValvePlan[]; weather: WeatherDay[]; live: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const days = valves[0]?.days ?? []
  const totals = days.map((_, i) => valves.reduce((a, v) => a + v.days[i].minutes, 0))
  const max = Math.max(...totals, 1) * 1.1
  const H = 200
  return (
    <Card className="md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[28px] font-semibold md:text-[32px]">The next 7 days</h2>
          <p className="mt-1 text-[15px] text-ink/70">
            Total watering time each day. <span className="font-semibold text-[#8a5413]">Amber days</span> are salt wash days — Namak picks the
            coolest days, when plants drink least.
          </p>
        </div>
        <SourceTag>{live ? 'Live weather forecast' : 'Saved weather forecast'}</SourceTag>
      </div>

      <div className="mt-6 flex items-end gap-2 sm:gap-4" style={{ height: H + 56 }} role="img" aria-label="Bar chart of watering minutes for the next seven days">
        {days.map((d, i) => {
          const wash = valves.some((v) => v.days[i].isRepaymentDay)
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className={`mb-1 text-[12px] font-semibold tabular ${hover === i ? 'text-ink' : 'text-ink/65'}`}>{minutes(totals[i])}</span>
              <div
                className={`flex w-full max-w-[64px] flex-col-reverse overflow-hidden rounded-t-[12px] rounded-b-[6px] ${wash ? 'ring-2 ring-amber-warn ring-offset-2 ring-offset-transparent' : ''}`}
              >
                {valves.map((v, j) => (
                  <m.div
                    key={v.valve.id}
                    style={{ background: VALVE_COLORS[j % VALVE_COLORS.length] }}
                    initial={{ height: 0 }}
                    whileInView={{ height: (v.days[i].minutes / max) * H }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: EASE, delay: i * 0.06 }}
                  />
                ))}
              </div>
              <span className={`mt-2 text-[13px] font-semibold ${wash ? 'text-[#8a5413]' : 'text-ink/75'}`}>{i === 0 ? 'Tmrw' : weekday(d.date)}</span>
              <span className="text-[12px] text-ink/65 tabular">{weather[i]?.tmax !== undefined ? `${Math.round(weather[i].tmax!)}°C` : ''}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
        {valves.map((v, j) => (
          <span key={v.valve.id} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[4px]" style={{ background: VALVE_COLORS[j % VALVE_COLORS.length] }} />
            {v.valve.name} · {cropLabel(v.valve.cropId)}
          </span>
        ))}
      </div>

      <Details summary="See the exact minutes">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[320px] text-center text-[14px]">
            <thead>
              <tr className="text-ink/65">
                <th className="px-2 py-1 text-left font-medium">Day</th>
                {valves.map((v) => (
                  <th key={v.valve.id} className="px-2 py-1 font-medium">
                    {CROPS[v.valve.cropId].short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d.date} className="border-t border-black/[0.06]">
                  <td className="px-2 py-1.5 text-left font-semibold">{i === 0 ? 'Tomorrow' : weekday(d.date)}</td>
                  {valves.map((v) => (
                    <td key={v.valve.id} className={`px-2 py-1.5 tabular ${v.days[i].isRepaymentDay ? 'font-semibold text-[#8a5413]' : ''}`}>
                      {Math.round(v.days[i].minutes)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Details>
    </Card>
  )
}

function SkeletonTomorrow() {
  const { forecastError } = useApp()
  return (
    <div className="space-y-5">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-sand-200" />
      <div className="h-72 animate-pulse rounded-[32px] bg-night/90" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass h-64 animate-pulse rounded-[28px]" />
        ))}
      </div>
      {forecastError ? (
        <Card>
          <p className="font-semibold">{forecastError}</p>
          <Button className="mt-3" onClick={() => location.reload()}>
            Try again
          </Button>
        </Card>
      ) : (
        <p className="text-center text-sm text-ink/65">Loading tomorrow’s forecast…</p>
      )}
    </div>
  )
}
