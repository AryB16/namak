import { motion } from 'motion/react'
import { useMemo } from 'react'
import { Button, Card, SaltGauge, SourceTag } from '../components/ui'
import { IconSend } from '../components/icons'
import { CountUp, EASE, Reveal, Stagger, StaggerItem } from '../components/motion'
import { CROPS } from '../engine/crops'
import { planFarm, type ValvePlan } from '../engine/farm'
import type { ValveSchedule } from '../engine/plan'
import { dayLabel, int, litres, minutes, one, pct, weekday } from '../lib/format'
import { useApp } from '../state'

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
      <Reveal y={16} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-ink/65">{dayLabel(day0.date, 'long')}</p>
          <h1 className="text-[40px] leading-[1.05] font-semibold md:text-[56px]">Tomorrow</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <SourceTag>{live ? 'Live forecast · Open-Meteo' : 'Cached forecast · Open-Meteo'}</SourceTag>
          <SourceTag tone="sand">Illustrative farm & well EC</SourceTag>
        </div>
      </Reveal>

      <Reveal y={24}>
        <section className="relative overflow-hidden rounded-[32px] bg-night p-6 text-white md:p-10">
          <div
            aria-hidden
            className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(95,211,198,0.32),transparent_65%)] blur-2xl"
          />
          <div className="relative grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-end">
            <div>
              <p className="text-[15px] font-semibold text-glow-water">Water tomorrow</p>
              <p className="mt-2 text-[64px] leading-[0.95] font-semibold tracking-[-0.045em] tabular [text-shadow:0_0_40px_rgba(95,211,198,0.35)] md:text-[96px]">
                <CountUp value={totalMin} format={(n) => minutes(n)} duration={1.2} />
              </p>
              <p className="mt-3 text-[17px] text-white/70">
                {plan.valves.length} valves, one after another · {first?.start} → {last?.end}
                {last && last.end <= sunrise ? ` · done before sunrise (${sunrise})` : ` · sunrise ${sunrise}`}
              </p>
              <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/80">
                Your well is salty ({one(farm.wellEC)} dS/m). Every litre leaves salt in the soil — a{' '}
                <span className="font-semibold text-glow-salt">salt debt</span>. Namak adds just enough water to flush it
                {anyDebt ? ', and pays the debt down on this week’s coolest days.' : ', and not a litre more.'}
              </p>
              <a
                href="#worker"
                className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-[16px] font-semibold text-ink shadow-[0_10px_40px_-12px_rgba(95,211,198,0.8)] transition-transform hover:scale-[1.03]"
              >
                <IconSend className="h-4 w-4" /> Send to worker
              </a>
            </div>

            <div className="rounded-[24px] bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur md:p-6">
              <CompareBar label="Worker’s habit" min={habitMin} l={habitL} max={Math.max(habitMin, totalMin)} tone="habit" />
              <CompareBar label="Namak" min={totalMin} l={namakL} max={Math.max(habitMin, totalMin)} tone="namak" />
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-[13px] font-medium text-white/60">{saved >= 0 ? 'Namak saves tomorrow' : 'Namak adds tomorrow'}</p>
                <p className="mt-1 text-[40px] leading-none font-semibold tracking-[-0.03em] text-glow-water tabular">
                  <CountUp value={Math.abs(saved)} format={(n) => litres(n)} />
                </p>
                <p className="mt-1 text-[13px] text-white/60">
                  ≈ AED {int((Math.abs(saved) / 1000) * farm.waterCostAedM3)} of water {saved >= 0 ? 'saved' : 'extra, to keep salt off the roots'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plan.valves.map((vp) => (
          <StaggerItem key={vp.valve.id}>
            <ValveCard vp={vp} slot={plan.schedule.find((s) => s.valveId === vp.valve.id)} />
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal>
        <WeekPlan valves={plan.valves} live={live} />
      </Reveal>
    </div>
  )
}

function CompareBar({ label, min, l, max, tone }: { label: string; min: number; l: number; max: number; tone: 'habit' | 'namak' }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className={tone === 'namak' ? 'font-semibold text-white' : 'text-white/65'}>{label}</span>
        <span className="tabular text-white/70">
          {minutes(min)} · {litres(l)}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${tone === 'namak' ? 'bg-glow-water' : 'bg-white/40'}`}
          initial={{ width: 0 }}
          animate={{ width: `${(min / max) * 100}%` }}
          transition={{ duration: 1.1, ease: EASE, delay: tone === 'namak' ? 0.25 : 0.1 }}
        />
      </div>
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
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3, ease: EASE }} className="h-full">
      <Card className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink/65">{vp.valve.name}</p>
            <p className="text-[21px] font-semibold">{crop.short === 'Fodder' ? 'Fodder grass' : crop.name}</p>
          </div>
          {d.isRepaymentDay && (
            <span className="rounded-full bg-amber-warn/15 px-2.5 py-1 text-[11px] font-semibold text-[#8a5413]">Debt repayment</span>
          )}
        </div>
        <p className="mt-4 text-[56px] leading-none font-semibold tracking-[-0.04em] text-teal-water tabular">
          <CountUp value={d.minutes} />
          <span className="ml-1.5 text-[17px] font-semibold tracking-normal text-ink/65">min</span>
        </p>
        <p className="mt-2 text-[15px] font-medium tabular text-ink/80">
          {slot?.start} → {slot?.end} <span className="text-ink/65">· {litres(d.litres)}</span>
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink/70">
          Crop needs {one(d.etc)} mm (heat ET₀ {one(d.et0)} × Kc {d.kc.toFixed(2)}), plus {pct(flushPct)} to flush salt from{' '}
          {one(vp.ecApplied)} dS/m water
          {d.isRepaymentDay && <> and {Math.round(repayMin)} min to repay salt debt on a cool day</>}. Habit: {Math.round(h.minutes)} min.
        </p>
        {vp.blend.needed && (
          <p className="mt-3 rounded-2xl bg-amber-warn/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
            Well water alone is too salty for {crop.name.toLowerCase()}. Mix <strong>{pct(vp.blend.cleanFraction)} RO water</strong> into this
            line → {one(vp.blend.blendEC)} dS/m.
          </p>
        )}
        <div className="mt-auto pt-5">
          <SaltGauge ece={vp.eceNow} crop={crop} target={vp.target} />
        </div>
      </Card>
    </motion.div>
  )
}

function WeekPlan({ valves, live }: { valves: ValvePlan[]; live: boolean }) {
  const days = valves[0]?.days ?? []
  const maxEt0 = Math.max(...days.map((d) => d.et0), 1)
  return (
    <Card className="md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[28px] font-semibold md:text-[32px]">Next 7 days</h2>
          <p className="mt-1 text-[14px] text-ink/65">
            Minutes per valve. <span className="font-semibold text-[#8a5413]">Amber</span> = salt-debt repayment, placed on the coolest days.
          </p>
        </div>
        <SourceTag>{live ? 'Live forecast · Open-Meteo' : 'Cached forecast · Open-Meteo'}</SourceTag>
      </div>
      <div className="mt-6 -mx-2 overflow-x-auto">
        <table className="w-full min-w-[340px] text-center text-[15px]">
          <thead>
            <tr className="text-[12px] text-ink/65">
              <th className="px-2 py-2 text-left font-medium">Day</th>
              {valves.map((v) => (
                <th key={v.valve.id} className="px-2 py-2 font-medium">
                  {CROPS[v.valve.cropId].short}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Heat (ET₀)</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.date} className="border-t border-black/[0.06]">
                <td className="px-2 py-3 text-left font-semibold">{i === 0 ? 'Tomorrow' : weekday(d.date)}</td>
                {valves.map((v) => {
                  const vd = v.days[i]
                  return (
                    <td key={v.valve.id} className="px-2 py-3 tabular">
                      <span
                        className={
                          vd.isRepaymentDay ? 'rounded-full bg-amber-warn/15 px-2.5 py-1 font-semibold text-[#8a5413]' : 'text-ink/85'
                        }
                      >
                        {Math.round(vd.minutes)}
                      </span>
                    </td>
                  )
                })}
                <td className="px-2 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-sand-200">
                      <motion.div
                        className="h-full rounded-full bg-amber-warn"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(d.et0 / maxEt0) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: EASE, delay: i * 0.05 }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[12px] tabular text-ink/65">{one(d.et0)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-ink/65">Heat = reference evapotranspiration ET₀, mm/day (FAO-56 Penman-Monteith).</p>
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
          <div key={i} className="h-64 animate-pulse rounded-[28px] bg-salt" />
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
