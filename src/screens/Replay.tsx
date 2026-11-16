import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Eyebrow, SourceTag } from '../components/ui'
import { IconPause, IconPlay } from '../components/icons'
import { CROPS } from '../engine/crops'
import { replaySeason, totals, type ValveDay } from '../engine/plan'
import { dayLabel, int, one } from '../lib/format'
import { useApp } from '../state'
import { useDemoEvent } from '../demo/Demo'

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
  const [hover, setHover] = useState<number | null>(null)
  useDemoEvent('play-replay', () => {
    setIdx(0)
    setPlaying(false)
    requestAnimationFrame(() => setPlaying(true))
  })
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

  const hoverRow = hover !== null && hover < shown.length ? full[hover] : null

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Proof: does it really work?</Eyebrow>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold text-ink md:text-[48px]">
          Last year, replayed with real weather.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/75">
          We took last year’s real weather for this farm and played it back, day by day, twice: once with the worker’s usual
          habit, once with Namak’s plan. Press play and watch what happens to the water and to the salt in the soil.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceTag>Real weather from ERA5, a scientific weather record</SourceTag>
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
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${v.id === valve.id ? 'bg-ink text-white' : 'glass text-ink hover:bg-white'}`}
          >
            {v.name} · {CROPS[v.cropId].short}
          </button>
        ))}
      </div>

      <div data-demo="replay-chart">
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

        <ChartTitle
          title="Water used so far"
          unit="cubic metres"
          habit={(hoverRow ?? cur)?.habitM3}
          namak={(hoverRow ?? cur)?.namakM3}
          fmt={(x) => int(x)}
          date={hoverRow?.date}
        />
        <Lines
          rows={full}
          shown={shown.length}
          a="habitM3"
          b="namakM3"
          max={maxM3}
          yFmt={(x) => (x >= 1000 ? `${one(x / 1000).replace('.0', '')}k` : int(x))}
          hover={hover}
          onHover={setHover}
        />

        <ChartTitle
          title="Salt in the soil — dashed line is the safe level"
          unit="dS/m"
          habit={(hoverRow ?? cur)?.habitECe}
          namak={(hoverRow ?? cur)?.namakECe}
          fmt={one}
          date={hoverRow?.date}
        />
        <Lines
          rows={full}
          shown={shown.length}
          a="habitECe"
          b="namakECe"
          max={maxECe}
          yFmt={(x) => String(Math.round(x))}
          refLine={{ y: result.target, label: `${crop.short} safe level ${one(result.target)}` }}
          hover={hover}
          onHover={setHover}
        />
        <div className="mt-2 flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full" style={{ background: HABIT }} /> Habit ({int(valve.habitMinutes ?? farm.habitMinutes)} min every day)</span>
          <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full" style={{ background: TEAL }} /> Namak</span>
        </div>
      </Card>
      </div>

      <div className={`grid grid-cols-2 gap-3 transition-opacity duration-500 ${done ? 'opacity-100' : 'opacity-40'}`} aria-live="polite">
        <Verdict
          big={`${savedM3 >= 0 ? '' : '+'}${int(Math.abs(savedM3))} m³`}
          label={savedM3 >= 0 ? 'less water than the usual routine' : 'more water than the usual routine'}
          sub={savedM3 >= 0 ? `${int((savedM3 / (result.th.litres / 1000)) * 100)}% saved · AED ${int(savedM3 * farm.waterCostAedM3)}` : 'spent to keep salt off the roots'}
          tone={savedM3 >= 0 ? 'teal' : 'amber'}
        />
        {result.tn.yieldPct - result.th.yieldPct >= 1 ? (
          <Verdict
            big={`${int(result.th.yieldPct)}% → ${int(result.tn.yieldPct)}%`}
            label="harvest: usual routine → Namak"
            sub={`days the soil was too salty: routine ${result.habitOver}, Namak ${result.namakOver}`}
            tone="red"
          />
        ) : (
          <Verdict
            big={`${result.habitOver} → ${result.namakOver}`}
            label="days the soil was too salty: usual routine → Namak"
            sub={`harvest: routine ${int(result.th.yieldPct)}%, Namak ${int(result.tn.yieldPct)}%`}
            tone={result.habitOver > result.namakOver ? 'red' : 'teal'}
          />
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-ink/65">
        Both start from the same soil ({one(valve.soilECe)} dS/m). In the replay Namak knows the next week’s weather exactly; real
        forecasts are a little less accurate. Harvest is estimated from soil salt using UN FAO crop data. Namak scheduled{' '}
        {result.repayDays} salt wash days.
      </p>
    </div>
  )
}

function ChartTitle({ title, unit, habit, namak, fmt, date }: { title: string; unit: string; habit?: number; namak?: number; fmt: (x: number) => string; date?: string }) {
  return (
    <div className="mt-4 mb-1 flex items-baseline justify-between gap-2">
      <p className="text-[13px] font-semibold text-ink/80">
        {title} <span className="font-normal text-ink/65">({unit})</span>
      </p>
      <p className="shrink-0 text-xs tabular">
        {date && <span className="mr-2 text-ink/65">{dayLabel(date)}</span>}
        <span style={{ color: HABIT }}>{habit !== undefined ? fmt(habit) : '–'}</span>
        <span className="text-ink/30"> / </span>
        <span style={{ color: TEAL }} className="font-semibold">{namak !== undefined ? fmt(namak) : '–'}</span>
      </p>
    </div>
  )
}

function Verdict({ big, label, sub, tone }: { big: string; label: string; sub: string; tone: 'teal' | 'red' | 'amber' }) {
  const c = { teal: 'text-teal-water', red: 'text-red-debt', amber: 'text-[#9a5d12]' }[tone]
  return (
    <div className="glass rounded-[28px] p-6">
      <p className={`text-[34px] leading-none font-semibold tracking-[-0.03em] tabular md:text-[44px] ${c}`}>{big}</p>
      <p className="mt-1.5 text-xs font-semibold text-ink/70">{label}</p>
      <p className="mt-0.5 text-[11px] text-ink/65">{sub}</p>
    </div>
  )
}

/** Lightweight two-line chart (plain SVG): habit vs Namak, drawn up to `shown` points, with hover read-out. */
function Lines({
  rows,
  shown,
  a,
  b,
  max,
  yFmt,
  refLine,
  hover,
  onHover,
}: {
  rows: Row[]
  shown: number
  a: 'habitM3' | 'habitECe'
  b: 'namakM3' | 'namakECe'
  max: number
  yFmt: (x: number) => string
  refLine?: { y: number; label: string }
  hover: number | null
  onHover: (i: number | null) => void
}) {
  const n = rows.length
  const x = (i: number) => (i / Math.max(1, n - 1)) * 1000
  const y = (v: number) => 100 - (v / max) * 100
  const path = (k: keyof Row) =>
    rows
      .slice(0, Math.max(1, shown))
      .map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[k] as number).toFixed(2)}`)
      .join('')
  const ticks = [0, 0.5, 1].map((f) => f * max)
  const months = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.date.endsWith('-01'))
  return (
    <div className="flex gap-2">
      <div className="relative h-44 w-9 shrink-0 text-right text-[11px] text-ink/65 tabular">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
            {yFmt(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="relative h-44 touch-pan-y"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            onHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))))
          }}
          onPointerLeave={() => onHover(null)}
        >
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {ticks.map((t) => (
              <line key={t} x1={0} x2={1000} y1={y(t)} y2={y(t)} stroke="#e8e8ed" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {refLine && (
              <line x1={0} x2={1000} y1={y(refLine.y)} y2={y(refLine.y)} stroke={LIMIT} strokeDasharray="5 4" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            )}
            <path d={path(a)} fill="none" stroke={HABIT} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={path(b)} fill="none" stroke={TEAL} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {refLine && (
            <span className="absolute right-0 -translate-y-full pb-0.5 text-[11px] font-semibold text-red-debt" style={{ top: `${y(refLine.y)}%` }}>
              {refLine.label}
            </span>
          )}
          {hover !== null && hover < shown && (
            <div className="pointer-events-none absolute inset-y-0 w-px bg-ink/30" style={{ left: `${(hover / Math.max(1, n - 1)) * 100}%` }} />
          )}
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-ink/65">
          {months
            .filter((_, k) => k % 2 === 0)
            .map(({ r, i }) => (
              <span key={r.date} className="absolute -translate-x-1/2" style={{ left: `${(i / Math.max(1, n - 1)) * 100}%` }}>
                {monthTick(r.date)}
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}
