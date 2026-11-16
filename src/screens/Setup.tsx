import type { ReactNode } from 'react'
import { Button, Card, Eyebrow, SourceTag } from '../components/ui'
import { CROP_LIST, type CropId } from '../engine/crops'
import { valveArea, type Farm, type Valve } from '../engine/plan'
import { int } from '../lib/format'
import { useApp } from '../state'

const PLACES = [
  { name: 'near Al Ain, UAE', lat: 24.21, lon: 55.74 },
  { name: 'Liwa, UAE', lat: 23.13, lon: 53.77 },
  { name: 'Dhaid, Sharjah, UAE', lat: 25.29, lon: 55.88 },
  { name: 'Al Kharj, Saudi Arabia', lat: 24.15, lon: 47.31 },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink/80">{label}</span>
      {hint && <span className="block text-[11px] text-ink/65">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputCls =
  'min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-[15px] tabular text-ink focus:border-teal-water'

function Num({ value, onChange, step = 1, min = 0 }: { value: number; onChange: (n: number) => void; step?: number; min?: number }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={inputCls}
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n) && n >= min) onChange(n)
      }}
    />
  )
}

export default function Setup() {
  const { farm, setFarm, resetFarm, isDemo } = useApp()
  const set = (patch: Partial<Farm>) => setFarm({ ...farm, ...patch })
  const setValve = (id: string, patch: Partial<Valve>) =>
    setFarm({ ...farm, valves: farm.valves.map((v) => (v.id === id ? { ...v, ...patch } : v)) })
  const addValve = () => {
    const n = farm.valves.length + 1
    setFarm({
      ...farm,
      valves: [
        ...farm.valves,
        {
          id: `v${Date.now()}`,
          name: `Valve ${n}`,
          cropId: 'cucumber',
          plants: 600,
          spacingM2: 0.5,
          emitters: 600,
          emitterLph: 2,
          plantingDate: new Date().toISOString().slice(0, 10),
          soilECe: 2.0,
          habitMinutes: farm.habitMinutes,
        },
      ],
    })
  }
  const removeValve = (id: string) => setFarm({ ...farm, valves: farm.valves.filter((v) => v.id !== id) })
  const place = PLACES.find((p) => Math.abs(p.lat - farm.lat) < 0.01 && Math.abs(p.lon - farm.lon) < 0.01)

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Farm setup · once</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] leading-[1.05] font-semibold text-teal-deep">Your farm</h1>
        <p className="mt-2 text-[15px] text-ink/70">
          The owner sets this up once. Everything is saved on this phone; no account needed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceTag tone="sand">{isDemo ? 'Illustrative demo farm' : 'Your edits · saved on this device'}</SourceTag>
        </div>
      </div>

      <Card className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Place & water</h2>
        <Field label="Location" hint="Weather comes from Open-Meteo for this point.">
          <select
            className={inputCls}
            value={place?.name ?? 'custom'}
            onChange={(e) => {
              const p = PLACES.find((x) => x.name === e.target.value)
              if (p) set({ place: p.name, lat: p.lat, lon: p.lon })
            }}
          >
            {PLACES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
            {!place && <option value="custom">{farm.place}</option>}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Well EC (dS/m)" hint="= mS/cm on an EC pen">
            <Num value={farm.wellEC} step={0.1} onChange={(n) => set({ wellEC: n })} />
          </Field>
          <Field label="Water cost (AED/m³)">
            <Num value={farm.waterCostAedM3} step={0.1} onChange={(n) => set({ waterCostAedM3: n })} />
          </Field>
          <Field label="Blend EC (dS/m)" hint="RO or treated water">
            <Num value={farm.cleanEC} step={0.1} onChange={(n) => set({ cleanEC: n })} />
          </Field>
          <Field label="Drip efficiency" hint="0.90 default (unverified)">
            <Num value={farm.efficiency} step={0.01} min={0.5} onChange={(n) => set({ efficiency: Math.min(1, n) })} />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-teal-water"
            checked={farm.canBlend}
            onChange={(e) => set({ canBlend: e.target.checked })}
          />
          We can blend in RO / treated water
        </label>
        <Field label="Longest a valve may run (min/day)">
          <Num value={farm.maxValveMinutes} step={10} onChange={(n) => set({ maxValveMinutes: n })} />
        </Field>
      </Card>

      {farm.valves.map((v) => {
        const crop = CROP_LIST.find((c) => c.id === v.cropId)!
        return (
          <Card key={v.id} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <input
                className="min-h-11 w-40 rounded-xl border border-transparent bg-transparent font-display text-xl font-semibold hover:border-sand-300"
                value={v.name}
                aria-label="Valve name"
                onChange={(e) => setValve(v.id, { name: e.target.value })}
              />
              <span className="font-mono text-xs text-ink/65">{int(valveArea(v))} m²</span>
            </div>
            <Field label="Crop">
              <select className={inputCls} value={v.cropId} onChange={(e) => setValve(v.id, { cropId: e.target.value as CropId })}>
                {CROP_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — salt limit {c.ecThreshold} dS/m
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plants">
                <Num value={v.plants} onChange={(n) => setValve(v.id, { plants: n })} />
              </Field>
              <Field label="Area per plant (m²)" hint="spacing">
                <Num value={v.spacingM2} step={0.1} onChange={(n) => setValve(v.id, { spacingM2: n })} />
              </Field>
              <Field label="Emitters on valve">
                <Num value={v.emitters} onChange={(n) => setValve(v.id, { emitters: n })} />
              </Field>
              <Field label="Emitter flow (L/h)">
                <Num value={v.emitterLph} step={0.5} onChange={(n) => setValve(v.id, { emitterLph: n })} />
              </Field>
              <Field label="Soil salinity ECe" hint="last soil test, dS/m">
                <Num value={v.soilECe} step={0.1} onChange={(n) => setValve(v.id, { soilECe: n })} />
              </Field>
              <Field label="Worker’s habit" hint="minutes every day">
                <Num value={v.habitMinutes ?? farm.habitMinutes} step={5} onChange={(n) => setValve(v.id, { habitMinutes: n })} />
              </Field>
            </div>
            {!crop.perennial && (
              <Field label="Planting date">
                <input
                  type="date"
                  className={inputCls}
                  value={v.plantingDate ?? ''}
                  onChange={(e) => setValve(v.id, { plantingDate: e.target.value })}
                />
              </Field>
            )}
            {farm.valves.length > 1 && (
              <Button variant="quiet" onClick={() => removeValve(v.id)}>
                Remove {v.name}
              </Button>
            )}
          </Card>
        )
      })}

      <div className="flex flex-wrap gap-3">
        <Button onClick={addValve}>Add a valve</Button>
        <Button variant="ghost" onClick={resetFarm}>
          Reset to demo farm
        </Button>
      </div>
    </div>
  )
}
