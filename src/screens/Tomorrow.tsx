import { useMemo } from 'react'
import { Button, Card, Eyebrow, SaltGauge, SourceTag } from '../components/ui'
import { IconSend } from '../components/icons'
import { CROPS } from '../engine/crops'
import { planFarm, type ValvePlan } from '../engine/farm'
import type { ValveSchedule } from '../engine/plan'
import { dayLabel, int, litres, minutes, one, pct, weekday } from '../lib/format'
import { useApp } from '../state'

export default function Tomorrow() {
  const { farm, planDays, forecast } = useApp()
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
  const anyDebt = plan.valves.some((v) => v.eceNow > v.target + 0.01)

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] bg-teal-water p-5 text-salt sm:p-7">
        <Ripple />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-salt/70">
            Tomorrow · {dayLabel(day0.date, 'long')}
          </p>
          <h1 className="mt-3 font-display text-[44px] leading-[1] font-semibold tabular sm:text-6xl">{minutes(totalMin)}</h1>
          <p className="mt-2 text-[15px] text-salt/85">
            of water across {plan.valves.length} valves · {first?.start} → {last?.end}
            {last && last.end <= (day0.sunrise ?? '06:15') ? `, done by sunrise (${day0.sunrise ?? '06:15'})` : ` · runs past sunrise (${day0.sunrise ?? '06:15'})`}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-salt/8 p-4 ring-1 ring-salt/15">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-salt/75">Worker's habit</p>
              <p className="mt-1 font-display text-2xl tabular">{minutes(habitMin)}</p>
              <p className="text-xs text-salt/75">{litres(habitL)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-salt/75">
                {saved >= 0 ? 'Namak saves' : 'Namak adds'}
              </p>
              <p className="mt-1 font-display text-2xl tabular text-[#9be3d6]">{litres(Math.abs(saved))}</p>
              <p className="text-xs text-salt/75">
                AED {int((Math.abs(saved) / 1000) * farm.waterCostAedM3)} {saved >= 0 ? 'saved' : 'extra'} tomorrow
              </p>
            </div>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-salt/90">
            Your well is salty ({one(farm.wellEC)} dS/m). Every litre leaves salt in the soil — a{' '}
            <strong className="text-[#f6c37a]">salt debt</strong>. Namak adds just enough water to flush it
            {anyDebt ? ', and pays the debt down on this week’s coolest days.' : ', and not a litre more.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="#worker"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#f6c37a] px-4 text-sm font-semibold text-ink hover:bg-[#f9d39a]"
            >
              <IconSend className="h-4 w-4" /> Send to worker
            </a>
            <span className="font-mono text-[11px] text-salt/75">
              {forecast?.source === 'live' ? forecast.label : 'Cached forecast · Open-Meteo'} · Illustrative farm & well EC
            </span>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {plan.valves.map((vp) => (
          <ValveCard key={vp.valve.id} vp={vp} slot={plan.schedule.find((s) => s.valveId === vp.valve.id)} />
        ))}
      </div>

      <WeekPlan valves={plan.valves} />
    </div>
  )
}

function ValveCard({ vp, slot }: { vp: ValvePlan; slot?: ValveSchedule }) {
  const crop = CROPS[vp.valve.cropId]
  const d = vp.days[0]
  const h = vp.habit[0]
  const flushPct = d.lr / (1 - d.lr)
  const repayMin = d.isRepaymentDay ? (d.repaymentMm / d.grossMm) * d.minutes : 0
  return (
    <Card className="p-0">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <Eyebrow>
            {vp.valve.name} · {crop.short}
          </Eyebrow>
          <p className="mt-2 font-display text-[40px] leading-none font-semibold text-teal-deep tabular">
            {Math.round(d.minutes)}
            <span className="ml-1.5 font-sans text-base font-semibold text-ink/60">min</span>
          </p>
        </div>
        <div className="text-right">
          <p className="whitespace-nowrap rounded-xl bg-teal-water/8 px-3 py-2 font-mono text-sm font-medium text-teal-water">
            {slot?.start} → {slot?.end}
          </p>
          <p className="mt-1.5 text-xs text-ink/65">{litres(d.litres)}</p>
        </div>
      </div>
      <p className="px-5 pt-3 text-[13px] leading-relaxed text-ink/75">
        <strong className="text-ink">Why:</strong> crop needs {one(d.etc)} mm (heat ET₀ {one(d.et0)} × Kc {d.kc.toFixed(2)}) +{' '}
        {pct(flushPct)} extra to flush the salt of {one(vp.ecApplied)} dS/m water
        {d.isRepaymentDay && (
          <>
            {' '}
            + <strong className="text-[#9a5d12]">{Math.round(repayMin)} min salt-debt repayment</strong> (one of this week’s
            coolest days)
          </>
        )}
        . Habit: {Math.round(h.minutes)} min.
      </p>
      {vp.blend.needed && (
        <p className="mx-5 mt-3 rounded-2xl bg-amber-warn/12 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink ring-1 ring-amber-warn/30">
          Well water alone is too salty for {crop.name.toLowerCase()}
          {Number.isFinite(vp.blend.lrWellOnly) ? ` (it would need ${pct(vp.blend.lrWellOnly)} of the water to drain through)` : ''}.
          Mix <strong>{pct(vp.blend.cleanFraction)} RO water</strong> into this line → {one(vp.blend.blendEC)} dS/m.
        </p>
      )}
      <div className="px-5 pt-4 pb-4">
        <SaltGauge ece={vp.eceNow} crop={crop} target={vp.target} />
      </div>
    </Card>
  )
}

function WeekPlan({ valves }: { valves: ValvePlan[] }) {
  const days = valves[0]?.days ?? []
  const maxEt0 = Math.max(...days.map((d) => d.et0), 1)
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold text-teal-deep">Next 7 days</h2>
        <SourceTag>Live forecast · Open-Meteo</SourceTag>
      </div>
      <p className="mt-1 text-[13px] text-ink/60">
        Minutes per valve. <span className="font-semibold text-[#9a5d12]">●</span> = salt-debt repayment, placed on the coolest
        days (lowest ET₀).
      </p>
      <div className="mt-4 -mx-1 overflow-x-auto">
        <table className="w-full min-w-[320px] border-separate border-spacing-x-1 text-center text-sm">
          <thead>
            <tr className="text-[11px] text-ink/65">
              <th className="text-left font-semibold">Day</th>
              {valves.map((v) => (
                <th key={v.valve.id} className="font-semibold">
                  {CROPS[v.valve.cropId].short}
                </th>
              ))}
              <th className="font-semibold">Heat</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.date}>
                <td className="py-1.5 text-left font-semibold text-ink/80">{i === 0 ? 'Tmrw' : weekday(d.date)}</td>
                {valves.map((v) => {
                  const vd = v.days[i]
                  return (
                    <td key={v.valve.id} className="py-1.5 font-mono tabular">
                      <span className={vd.isRepaymentDay ? 'font-semibold text-[#9a5d12]' : 'text-ink'}>
                        {Math.round(vd.minutes)}
                        {vd.isRepaymentDay && <span aria-label="repayment"> ●</span>}
                      </span>
                    </td>
                  )
                })}
                <td className="py-1.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="h-2 w-8 overflow-hidden rounded-full bg-sand-200">
                      <div className="h-full rounded-full bg-amber-warn" style={{ width: `${(d.et0 / maxEt0) * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-[11px] text-ink/60">{one(d.et0)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-ink/65">Heat = reference evapotranspiration ET₀, mm/day (FAO-56 Penman-Monteith).</p>
    </Card>
  )
}

function Ripple() {
  return (
    <svg className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-[0.12]" viewBox="0 0 200 200" aria-hidden>
      {[30, 55, 80, 100].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fffdf8" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

function SkeletonTomorrow() {
  const { forecastError } = useApp()
  return (
    <div className="space-y-4">
      <div className="h-64 animate-pulse rounded-[28px] bg-teal-water/80" />
      <div className="h-40 animate-pulse rounded-3xl bg-sand-200" />
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
