import { useMemo, useState } from 'react'
import { Button, Card, Eyebrow, SaltGauge, SourceTag } from '../components/ui'
import { CROPS } from '../engine/crops'
import { compareYear, type YearValve } from '../engine/farm'
import { aed, int, one, pct } from '../lib/format'
import { useTween } from '../lib/useTween'
import { useApp } from '../state'

/** FAO-29 Table 1: ECw < 0.7 none, 0.7–3.0 slight to moderate, > 3.0 severe restriction on use. */
function waterClass(ec: number) {
  if (ec < 0.7) return { label: 'Fresh', tone: 'text-green-ok' }
  if (ec <= 3.0) return { label: 'Brackish · slight–moderate', tone: 'text-[#9a5d12]' }
  return { label: 'Brackish · severe', tone: 'text-red-debt' }
}

export default function Compare() {
  const { farm, setFarm, year, yearError } = useApp()
  const [wellEC, setWellEC] = useState(farm.wellEC)
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
        <Eyebrow>Habit vs Namak</Eyebrow>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold text-ink md:text-[48px]">
          Salt costs this farm <span className="text-red-debt tabular">{int(saltM3)} m³</span> of water a year.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/75">
          That is the extra water needed to wash salt below the roots — the hidden water cost of a brackish well. Habit
          doesn’t budget for it: it wastes water in winter and pays in summer with salty soil and lost yield.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceTag>Historical weather · ERA5 via Open-Meteo</SourceTag>
          <SourceTag tone="sand">Illustrative well EC</SourceTag>
        </div>
      </div>

      {cmp && (
        <div className="grid grid-cols-3 gap-2.5">
          <Counter
            value={`${int(savedM3)}`}
            unit="m³"
            label={cmp.savedLitres >= 0 ? 'water saved / yr' : 'more water / yr'}
            tone={cmp.savedLitres >= 0 ? 'teal' : 'red'}
          />
          <Counter value={aed(Math.abs(savedAed)).replace('AED ', '')} unit="AED" label={cmp.savedLitres >= 0 ? 'saved / yr' : 'extra / yr'} tone="teal" />
          <Counter value={habitLossT >= 0.5 ? `−${int(habitLossT)}%` : '0%'} unit="" label="yield at risk with habit" tone={habitLoss > 0.5 ? 'red' : 'ink'} sub={`Namak ${namakLossT >= 0.5 ? `−${int(namakLossT)}%` : '0%'}`} />
        </div>

      )}

      <Card className="md:p-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <label htmlFor="well-ec" className="text-sm font-semibold text-ink/80">
              Well water salinity
            </label>
            <p className={`text-xs font-semibold ${wc.tone}`}>{wc.label} (FAO-29 Table 1)</p>
          </div>
          <p className="text-[44px] leading-none font-semibold tracking-[-0.03em] text-ink tabular">
            {one(wellEC)}
            <span className="ml-1 font-sans text-sm font-semibold text-ink/65">dS/m</span>
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
          <span>0.5 fresh</span>
          <span>3.0</span>
          <span>8 very salty</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={canBlend}
              onChange={(e) => setCanBlend(e.target.checked)}
              className="h-5 w-5 accent-teal-water"
            />
            Farm has RO / treated water to blend
          </label>
          {(wellEC !== farm.wellEC || canBlend !== farm.canBlend) && (
            <Button variant="ghost" onClick={() => setFarm({ ...farm, wellEC, canBlend })}>
              Use for my farm
            </Button>
          )}
        </div>
      </Card>

      {cmp && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SideCard
              title="Habit"
              subtitle="Same minutes, every day"
              litres={cmp.habitLitres}
              aedTotal={(cmp.habitLitres / 1000) * farm.waterCostAedM3}
              tone="sand"
            />
            <SideCard
              title="Namak"
              subtitle="Heat + salt, day by day"
              litres={cmp.namakLitres}
              aedTotal={(cmp.namakLitres / 1000) * farm.waterCostAedM3}
              tone="teal"
            />
          </div>

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
    <div className="rounded-[24px] bg-salt p-4 md:p-6">
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
        <p className="font-semibold">
          {v.valve.name} · {crop.name}
        </p>
        <p className="tabular text-xs text-ink/65">flush {pct(v.lf)} of water</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-ink/70">
            Habit · salt peaks at {one(v.habitPeakECe)} · season yield {int(v.habitYield)}%
          </p>
          <SaltGauge ece={v.habitPeakECe} crop={crop} target={v.target} compact />
        </div>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-teal-water">
            Namak · {v.lfCapped ? 'flush capped' : 'held at the limit'} · season yield {int(v.namakYield)}%
          </p>
          <SaltGauge ece={v.namakECe} crop={crop} target={v.target} compact />
        </div>
      </div>
      {v.blend.needed && (
        <p className="mt-2 rounded-2xl bg-amber-warn/12 px-3.5 py-2.5 text-[13px] leading-relaxed ring-1 ring-amber-warn/30">
          {canBlend ? (
            <>
              Too salty for {crop.name.toLowerCase()} alone. Blend <strong>{pct(v.blend.cleanFraction)} RO water</strong> into
              this line → {one(v.blend.blendEC)} dS/m, flush {pct(v.blend.lrWithBlend)}.
            </>
          ) : (
            <>
              Too salty for {crop.name.toLowerCase()}: flushing would need{' '}
              {Number.isFinite(v.blend.lrWellOnly) ? pct(v.blend.lrWellOnly) : 'more than all'} of the water (FAO-29: above 25–30% is
              not practical). Blend <strong>{pct(v.blend.cleanFraction)} RO water</strong>, or switch to a more tolerant crop.
            </>
          )}
        </p>
      )}
      {v.habitWaterMet < 0.97 && (
        <p className="mt-2 text-[12px] text-ink/70">Habit also leaves this crop short: it meets {pct(v.habitWaterMet)} of the year’s crop water need.</p>
      )}
    </Card>
  )
}
