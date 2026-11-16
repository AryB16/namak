import { animate } from 'motion/react'
import { useMemo, useState } from 'react'
import { useDemoEvent } from '../demo/Demo'
import { Button, Card, Eyebrow, SaltGauge, SourceTag } from '../components/ui'
import { Term } from '../components/explain'
import { EASE } from '../components/motion'
import { m } from 'motion/react'
import { CROPS } from '../engine/crops'
import { compareYear, type YearValve } from '../engine/farm'
import { aed, int, one, pct } from '../lib/format'
import { useTween } from '../lib/useTween'
import { useApp } from '../state'

/** FAO-29 Table 1: ECw < 0.7 none, 0.7–3.0 slight to moderate, > 3.0 severe restriction on use. */
function waterClass(ec: number) {
  if (ec < 0.7) return { label: 'Fresh water — no salt problem', tone: 'text-green-ok' }
  if (ec <= 3.0) return { label: 'Slightly salty — needs care', tone: 'text-[#9a5d12]' }
  return { label: 'Very salty — needs a lot of washing', tone: 'text-red-debt' }
}

/** An Olympic pool is 50 m × 25 m × 2 m = 2,500 m³. */
const POOL_M3 = 2500

export default function Compare() {
  const { farm, setFarm, year, yearError } = useApp()
  const [wellEC, setWellEC] = useState(farm.wellEC)
  // Guided demo: sweep the well salinity up and back so the counters and gauges visibly react.
  useDemoEvent('sweep-slider', () => {
    const base = farm.wellEC
    const round = (v: number) => setWellEC(Math.round(v * 10) / 10)
    animate(base, 6.5, { duration: 2.6, ease: [0.65, 0, 0.35, 1], onUpdate: round }).then(() =>
      setTimeout(() => animate(6.5, base, { duration: 1.8, ease: [0.65, 0, 0.35, 1], onUpdate: round }), 1400),
    )
  })
  const [canBlend, setCanBlend] = useState(farm.canBlend)
  const preview = useMemo(() => ({ ...farm, wellEC, canBlend }), [farm, wellEC, canBlend])
  const cmp = useMemo(() => (year ? compareYear(preview, year.days) : null), [preview, year])

  const savedM3 = useTween(cmp ? cmp.savedLitres / 1000 : 0)
  const savedAed = useTween(cmp ? cmp.savedAed : 0)
  const saltM3 = useTween(cmp ? cmp.saltLitres / 1000 : 0)
  const habitLoss = cmp ? Math.max(...cmp.valves.map((v) => 100 - v.habitYield)) : 0
  const namakLoss = cmp ? Math.max(...cmp.valves.map((v) => 100 - v.namakYield)) : 0
  const habitLossT = useTween(habitLoss)
  const namakLossT = useTween(namakLoss)
  const wc = waterClass(wellEC)

  if (!year)
    return (
      <Card>
        <p className="font-semibold">{yearError ?? 'Loading a year of real weather (ERA5)…'}</p>
      </Card>
    )

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>The worker’s habit vs Namak</Eyebrow>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold text-ink md:text-[48px]">
          Salty water costs this farm{' '}
          <span className="text-red-debt tabular">
            {saltM3 >= 1000 ? `${one(saltM3 / 1000)} million litres` : `${int(saltM3 * 1000)} litres`}
          </span>{' '}
          a year.
        </h1>
        <p className="mt-3 max-w-[760px] text-[16px] leading-relaxed text-ink/75">
          Here is the problem in one line: the well water is salty, salt builds up in the soil, and the only fix is extra water to
          wash it below the roots. Most farms just water the same amount every day and hope. Below, we compare that habit with
          Namak’s plan over a full year of real weather.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceTag>Real weather, last 12 months</SourceTag>
          <SourceTag tone="sand">Example farm</SourceTag>
        </div>
      </div>

      {cmp && (
        <div data-demo="counters" className="grid grid-cols-3 gap-2.5">
          <Counter
            value={`${int(savedM3)}`}
            unit="m³"
            label={cmp.savedLitres >= 0 ? 'less water a year with Namak' : 'more water a year'}
            sub={`≈ ${one(Math.abs(savedM3) / POOL_M3)} Olympic swimming pools`}
            tone={cmp.savedLitres >= 0 ? 'teal' : 'red'}
          />
          <Counter value={aed(Math.abs(savedAed)).replace('AED ', '')} unit="AED" label={cmp.savedLitres >= 0 ? 'saved on water a year' : 'extra a year'} tone="teal" />
          <Counter value={habitLossT >= 0.5 ? `−${int(habitLossT)}%` : '0%'} unit="" label="crop lost to salt with the habit" tone={habitLoss > 0.5 ? 'red' : 'ink'} sub={`With Namak: ${namakLossT >= 0.5 ? `−${int(namakLossT)}%` : 'none'}`} />
        </div>

      )}

      <div data-demo="slider">
      <Card className="md:p-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <label htmlFor="well-ec" className="text-[17px] font-semibold text-ink">
              How salty is the well? <span className="font-normal text-ink/65">Drag to try</span>
            </label>
            <p className={`text-[13px] font-semibold ${wc.tone}`}>{wc.label}</p>
          </div>
          <p className="text-[44px] leading-none font-semibold tracking-[-0.03em] text-ink tabular">
            {one(wellEC)}
            <span className="ml-1 font-sans text-sm font-semibold text-ink/65">
              <Term k="dS/m" />
            </span>
          </p>
        </div>
        <input
          id="well-ec"
          type="range"
          min={0.5}
          max={8}
          step={0.1}
          value={wellEC}
          onChange={(e) => setWellEC(Number(e.target.value))}
          className="salt-slider mt-4 w-full"
          aria-valuetext={`${one(wellEC)} deciSiemens per metre`}
        />
        <div className="mt-1 flex justify-between tabular text-[11px] text-ink/65">
          <span>Fresh</span>
          <span>Salty</span>
          <span>Very salty</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={canBlend}
              onChange={(e) => setCanBlend(e.target.checked)}
              className="h-5 w-5 accent-teal-water"
            />
            The farm can mix in clean (desalinated) water
          </label>
          {(wellEC !== farm.wellEC || canBlend !== farm.canBlend) && (
            <Button variant="ghost" onClick={() => setFarm({ ...farm, wellEC, canBlend })}>
              Use for my farm
            </Button>
          )}
        </div>
      </Card>
      </div>

      {cmp && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SideCard
              title="The usual habit"
              subtitle="Same minutes every day, all year"
              litres={cmp.habitLitres}
              aedTotal={(cmp.habitLitres / 1000) * farm.waterCostAedM3}
              tone="sand"
            />
            <SideCard
              title="Namak"
              subtitle="Adjusted daily for heat and salt"
              litres={cmp.namakLitres}
              aedTotal={(cmp.namakLitres / 1000) * farm.waterCostAedM3}
              tone="teal"
            />
          </div>

          <MonthlyChart monthly={cmp.monthly} />

          <div className="space-y-3">
            {cmp.valves.map((v) => (
              <ValveCompare key={v.valve.id} v={v} canBlend={canBlend} />
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-ink/65">
            Namak here = daily maintenance plan over the last 12 months of ERA5 weather (salt held at each crop’s limit by
            design). Habit = the worker’s fixed minutes, run through the FAO-61 salt model. Yield = salt-limited relative
            yield (FAO-29 / FAO-56 Table 23); water stress from under-watering is not counted, so habit losses are, if
            anything, understated.
          </p>
        </>
      )}
    </div>
  )
}

function Counter({ value, unit, label, sub, tone }: { value: string; unit: string; label: string; sub?: string; tone: 'teal' | 'red' | 'ink' }) {
  const t = { teal: 'text-teal-water', red: 'text-red-debt', ink: 'text-ink' }[tone]
  return (
    <div className="glass rounded-[24px] p-4 md:p-6">
      <p className={`text-[26px] leading-none font-semibold tracking-[-0.03em] tabular md:text-[40px] ${t}`}>
        {value}
        {unit && <span className="ml-0.5 font-sans text-xs font-semibold text-ink/65">{unit}</span>}
      </p>
      <p className="mt-1.5 text-[11px] leading-tight font-semibold text-ink/65">{label}</p>
      {sub && <p className="text-[11px] text-ink/65">{sub}</p>}
    </div>
  )
}

function SideCard({ title, subtitle, litres, aedTotal, tone }: { title: string; subtitle: string; litres: number; aedTotal: number; tone: 'sand' | 'teal' }) {
  const m3 = useTween(litres / 1000)
  return (
    <div className={`rounded-[28px] p-5 md:p-7 ${tone === 'teal' ? 'bg-night text-white' : 'bg-sand-200/80 text-ink'}`}>
      <p className="text-[21px] font-semibold">{title}</p>
      <p className={`text-xs ${tone === 'teal' ? 'text-salt/70' : 'text-ink/70'}`}>{subtitle}</p>
      <p className="mt-4 text-[34px] leading-none font-semibold tracking-[-0.03em] tabular md:text-[48px]">
        {int(m3)}
        <span className="ml-1 font-sans text-xs font-semibold opacity-70">m³/yr</span>
      </p>
      <p className={`text-xs ${tone === 'teal' ? 'text-salt/70' : 'text-ink/70'}`}>{aed(aedTotal)} of water</p>
    </div>
  )
}

function ValveCompare({ v, canBlend }: { v: YearValve; canBlend: boolean }) {
  const crop = CROPS[v.valve.cropId]
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[17px] font-semibold">
          {v.valve.name} · {crop.short === 'Fodder' ? 'Animal fodder grass' : crop.name}
        </p>
        <p className="text-[13px] text-ink/65">{pct(v.lf)} of its water goes to washing salt</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-ink/70">
            Usual habit: {v.habitPeakECe > v.target + 0.05 ? `soil gets too salty (up to ${one(v.habitPeakECe)}, safe is ${one(v.target)})` : 'soil stays safe'} · harvest {int(v.habitYield)}%
          </p>
          <SaltGauge ece={v.habitPeakECe} crop={crop} target={v.target} compact />
        </div>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-teal-water">
            Namak: {v.lfCapped ? 'well too salty to fully wash — needs clean water' : 'soil kept at the safe level all year'} · harvest {int(v.namakYield)}%
          </p>
          <SaltGauge ece={v.namakECe} crop={crop} target={v.target} compact />
        </div>
      </div>
      {v.blend.needed && (
        <p className="mt-2 rounded-2xl bg-amber-warn/12 px-3.5 py-2.5 text-[13px] leading-relaxed ring-1 ring-amber-warn/30">
          {canBlend ? (
            <>
              This well is too salty for {crop.name.toLowerCase()} on its own. Mixing in <strong>{pct(v.blend.cleanFraction)} clean water</strong>{' '}
              fixes it.
            </>
          ) : (
            <>
              Too salty for {crop.name.toLowerCase()}: washing the salt out would take far too much water. Mix in{' '}
              <strong>{pct(v.blend.cleanFraction)} clean water</strong>, or grow a crop that copes with salt better.
            </>
          )}
        </p>
      )}
      {v.habitWaterMet < 0.97 && (
        <p className="mt-2 text-[13px] text-ink/70">The habit also leaves this crop thirsty on hot days: it gives only {pct(v.habitWaterMet)} of what it needs over the year.</p>
      )}
    </Card>
  )
}

/** Month-by-month water: the habit's flat line vs Namak following the seasons. */
function MonthlyChart({ monthly }: { monthly: { month: string; namakL: number; habitL: number }[] }) {
  const max = Math.max(...monthly.map((mo) => Math.max(mo.namakL, mo.habitL)), 1) * 1.08
  const H = 180
  const label = (m: string, i: number) => {
    const name = new Date(m + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
    const dup = monthly.filter((x) => x.month.slice(5) === m.slice(5)).length > 1
    return dup || i === 0 ? `${name} ’${m.slice(2, 4)}` : name
  }
  return (
    <Card className="md:p-8">
      <h2 className="text-[24px] font-semibold md:text-[28px]">Month by month</h2>
      <p className="mt-1 max-w-[680px] text-[15px] text-ink/70">
        The habit pours the same amount all year: too much in the cool winter, too little in the summer heat. Namak follows the
        weather.
      </p>
      <div className="mt-6 flex items-end gap-1.5 sm:gap-3" style={{ height: H + 28 }} role="img" aria-label="Monthly water use, habit versus Namak">
        {monthly.map((mo, i) => (
          <div key={mo.month} className="flex h-full flex-1 flex-col items-center justify-end">
            <div className="flex w-full items-end justify-center gap-[3px]">
              <m.div
                className="w-1/2 max-w-[18px] rounded-t-[6px] bg-sand-300"
                initial={{ height: 0 }}
                whileInView={{ height: (mo.habitL / max) * H }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: EASE, delay: i * 0.04 }}
              />
              <m.div
                className="w-1/2 max-w-[18px] rounded-t-[6px] bg-teal-water"
                initial={{ height: 0 }}
                whileInView={{ height: (mo.namakL / max) * H }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.04 }}
              />
            </div>
            <span className="mt-2 text-[11px] font-medium text-ink/65">{label(mo.month, i)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-5 text-[13px]">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[4px] bg-sand-300" /> Usual habit
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[4px] bg-teal-water" /> Namak
        </span>
      </div>
    </Card>
  )
}
