import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Eyebrow, SourceTag } from '../components/ui'
import { IconPause, IconPlay } from '../components/icons'
import { CROPS } from '../engine/crops'
import { replaySeason, totals, type ValveDay } from '../engine/plan'
import { dayLabel, int, one } from '../lib/format'
import { useApp } from '../state'

const TEAL = '#0a6f69'
const HABIT = '#e08a1e'
const LIMIT = '#c0362c'

interface Row {
  date: string
  habitM3: number
  namakM3: number
  habitECe: number
  namakECe: number
}

function buildRows(namak: ValveDay[], habit: ValveDay[]): Row[] {
  let hn = 0
  let nn = 0
  return namak.map((d, i) => {
    nn += d.litres / 1000
    hn += habit[i].litres / 1000
    return { date: d.date, habitM3: hn, namakM3: nn, habitECe: habit[i].eceEnd, namakECe: d.eceEnd }
  })
}

const monthYear = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

const monthTick = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })

export default function Replay() {
  const { farm, year, yearError } = useApp()
  const [valveId, setValveId] = useState(farm.valves[0]?.id)
  const valve = farm.valves.find((v) => v.id === valveId) ?? farm.valves[0]

  const result = useMemo(() => {
    if (!year || !valve) return null
    const r = replaySeason(farm, valve, year.days)
    return {
      rows: buildRows(r.namak, r.habit),
      tn: totals(farm, valve, r.namak),
      th: totals(farm, valve, r.habit),
      target: r.namak[0]?.target ?? CROPS[valve.cropId].ecThreshold,
      habitOver: r.habit.filter((d) => d.eceEnd > d.target + 0.05).length,
      namakOver: r.namak.filter((d) => d.eceEnd > d.target + 0.05).length,
      repayDays: r.namak.filter((d) => d.isRepaymentDay).length,
    }
  }, [farm, valve, year])

  const n = result?.rows.length ?? 0
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)

  // Autoplay once per valve when the screen opens.
  useEffect(() => {
    if (!n) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setIdx(reduce ? n : 0)
    setPlaying(!reduce)
  }, [n, valveId])

  useEffect(() => {
    if (!playing || !n) return
    const durationMs = 7000
    const t0 = performance.now() - (idx / n) * durationMs
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / durationMs)
      setIdx(Math.max(1, Math.round(k * n)))
      if (k < 1) raf.current = requestAnimationFrame(step)
      else setPlaying(false)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, n])

  if (!year)
    return (
      <Card>
        <p className="font-semibold">{yearError ?? 'Loading last year’s weather (ERA5)…'}</p>
      </Card>
    )
  if (!result || !valve) return null

  const crop = CROPS[valve.cropId]
  const shown = result.rows.slice(0, Math.max(1, idx))
  const cur = shown[shown.length - 1]
  const full = result.rows
  const maxM3 = Math.max(full[full.length - 1].habitM3, full[full.length - 1].namakM3) * 1.05
  const maxECe = Math.max(crop.ec90 * 1.15, ...full.map((r) => Math.max(r.habitECe, r.namakECe))) * 1.05
  const savedM3 = (result.th.litres - result.tn.litres) / 1000
  const done = idx >= n

  // Pad the visible series to full length so axes stay fixed while it animates.
  const data = full.map((r, i) => (i < shown.length ? r : { date: r.date }))

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Season replay · proof it beats the guess</Eyebrow>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold text-ink md:text-[48px]">
          Last year, replayed with real weather.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/75">
          Same farm, same well, same days. One worker follows habit; the other follows Namak, re-planning each day with the
          coming week’s weather.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceTag>Historical weather · ERA5 via Open-Meteo</SourceTag>
          <SourceTag tone="sand">
            {monthYear(full[0].date)} – {monthYear(full[full.length - 1].date)}
          </SourceTag>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Valve">
        {farm.valves.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={v.id === valve.id}
            onClick={() => setValveId(v.id)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${v.id === valve.id ? 'bg-ink text-white' : 'bg-salt text-ink hover:bg-white/60'}`}
          >
            {v.name} · {CROPS[v.cropId].short}
          </button>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="tabular text-xs text-ink/65">{cur ? dayLabel(cur.date, 'long') : ''}</p>
            <p className="text-sm font-semibold">{crop.name}{!crop.perennial && ' · one growing season'}</p>
          </div>
          <button
            onClick={() => {
              if (done) setIdx(0)
              setPlaying((p) => !p || done)
            }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-water text-salt"
            aria-label={playing ? 'Pause replay' : 'Play replay'}
          >
            {playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
          </button>
        </div>

        <ChartTitle title="Water used, cumulative" unit="m³" habit={cur?.habitM3} namak={cur?.namakM3} fmt={(x) => int(x)} />
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e8e8ed" vertical={false} />
              <XAxis dataKey="date" tickFormatter={monthTick} interval={Math.max(1, Math.floor(n / 6))} tick={{ fontSize: 10, fill: '#6e6e73' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, Math.ceil(maxM3)]} tick={{ fontSize: 10, fill: '#6e6e73' }} axisLine={false} tickLine={false} width={40} tickFormatter={(x) => (x >= 1000 ? `${one(x / 1000).replace('.0', '')}k` : int(x))} />
              <Tooltip content={<Tip unit="m³" a="habitM3" b="namakM3" />} />
              <Line type="monotone" dataKey="habitM3" stroke={HABIT} strokeWidth={2.5} dot={false} isAnimationActive={false} name="Habit" />
              <Line type="monotone" dataKey="namakM3" stroke={TEAL} strokeWidth={3} dot={false} isAnimationActive={false} name="Namak" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <ChartTitle title="Root-zone salt (Salt Debt)" unit="dS/m" habit={cur?.habitECe} namak={cur?.namakECe} fmt={one} />
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e8e8ed" vertical={false} />
              <XAxis dataKey="date" tickFormatter={monthTick} interval={Math.max(1, Math.floor(n / 6))} tick={{ fontSize: 10, fill: '#6e6e73' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, Math.ceil(maxECe)]} tick={{ fontSize: 10, fill: '#6e6e73' }} axisLine={false} tickLine={false} width={40} />
              <ReferenceLine y={result.target} stroke={LIMIT} strokeDasharray="5 4" label={{ value: `${crop.short} limit ${one(result.target)}`, position: 'insideBottomRight', fontSize: 10, fill: LIMIT }} />
              <Tooltip content={<Tip unit="dS/m" a="habitECe" b="namakECe" />} />
              <Line type="monotone" dataKey="habitECe" stroke={HABIT} strokeWidth={2.5} dot={false} isAnimationActive={false} name="Habit" />
              <Line type="monotone" dataKey="namakECe" stroke={TEAL} strokeWidth={3} dot={false} isAnimationActive={false} name="Namak" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full" style={{ background: HABIT }} /> Habit ({int(valve.habitMinutes ?? farm.habitMinutes)} min every day)</span>
          <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full" style={{ background: TEAL }} /> Namak</span>
        </div>
      </Card>

      <div className={`grid grid-cols-2 gap-3 transition-opacity duration-500 ${done ? 'opacity-100' : 'opacity-40'}`} aria-live="polite">
        <Verdict
          big={`${savedM3 >= 0 ? '' : '+'}${int(Math.abs(savedM3))} m³`}
          label={savedM3 >= 0 ? 'less water than habit' : 'more water than habit'}
          sub={savedM3 >= 0 ? `${int((savedM3 / (result.th.litres / 1000)) * 100)}% saved · AED ${int(savedM3 * farm.waterCostAedM3)}` : 'spent to keep salt off the roots'}
          tone={savedM3 >= 0 ? 'teal' : 'amber'}
        />
        {result.tn.yieldPct - result.th.yieldPct >= 1 ? (
          <Verdict
            big={`${int(result.th.yieldPct)}% → ${int(result.tn.yieldPct)}%`}
            label="season yield, habit → Namak"
            sub={`days over the salt limit: habit ${result.habitOver}, Namak ${result.namakOver}`}
            tone="red"
          />
        ) : (
          <Verdict
            big={`${result.habitOver} → ${result.namakOver}`}
            label="days over the salt limit, habit → Namak"
            sub={`season yield: habit ${int(result.th.yieldPct)}%, Namak ${int(result.tn.yieldPct)}%`}
            tone={result.habitOver > result.namakOver ? 'red' : 'teal'}
          />
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-ink/65">
        Both workers start from the same soil test ({one(valve.soilECe)} dS/m). Namak re-plans every day using the next 7 days of
        the recorded weather as its forecast (a perfect forecast — real forecasts are less accurate). Salt-limited yield from
        season-mean root-zone ECe (FAO-29 / FAO-56 Table 23). Namak scheduled {result.repayDays} salt-debt repayment days.
      </p>
    </div>
  )
}

function ChartTitle({ title, unit, habit, namak, fmt }: { title: string; unit: string; habit?: number; namak?: number; fmt: (x: number) => string }) {
  return (
    <div className="mt-4 mb-1 flex items-baseline justify-between gap-2">
      <p className="text-[13px] font-semibold text-ink/80">
        {title} <span className="font-normal text-ink/65">({unit})</span>
      </p>
      <p className="tabular text-xs tabular">
        <span style={{ color: HABIT }}>{habit !== undefined ? fmt(habit) : '–'}</span>
        <span className="text-ink/30"> / </span>
        <span style={{ color: TEAL }} className="font-semibold">{namak !== undefined ? fmt(namak) : '–'}</span>
      </p>
    </div>
  )
}

function Tip({ active, payload, unit, a, b }: { active?: boolean; payload?: { payload: Record<string, number | string> }[]; unit: string; a: string; b: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p[a] === undefined) return null
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs text-salt shadow-lg">
      <p className="tabular text-[11px] text-salt/75">{dayLabel(String(p.date))}</p>
      <p>Habit {one(Number(p[a]))} {unit}</p>
      <p className="font-semibold">Namak {one(Number(p[b]))} {unit}</p>
    </div>
  )
}

function Verdict({ big, label, sub, tone }: { big: string; label: string; sub: string; tone: 'teal' | 'red' | 'amber' }) {
  const c = { teal: 'text-teal-water', red: 'text-red-debt', amber: 'text-[#9a5d12]' }[tone]
  return (
    <div className="rounded-[28px] bg-salt p-6">
      <p className={`text-[34px] leading-none font-semibold tracking-[-0.03em] tabular md:text-[44px] ${c}`}>{big}</p>
      <p className="mt-1.5 text-xs font-semibold text-ink/70">{label}</p>
      <p className="mt-0.5 text-[11px] text-ink/65">{sub}</p>
    </div>
  )
}
