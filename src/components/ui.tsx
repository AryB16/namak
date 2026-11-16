import type { ReactNode } from 'react'
import type { Crop } from '../engine/crops'
import { one } from '../lib/format'

export function SourceTag({ children, tone = 'teal' }: { children: ReactNode; tone?: 'teal' | 'sand' | 'amber' }) {
  const tones = {
    teal: 'bg-teal-water/8 text-teal-water ring-teal-water/20',
    sand: 'bg-sand-200/60 text-sand-700 ring-sand-300',
    amber: 'bg-amber-warn/12 text-[#8a5413] ring-amber-warn/30',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] leading-none ring-1 ${tones[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {children}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-sand-200 bg-salt p-5 ${className}`}>{children}</section>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-sand-700">{children}</p>
}

export type DebtZone = 'ok' | 'debt' | 'loss'

export function debtZone(ece: number, crop: Crop, target: number): DebtZone {
  if (ece <= target + 0.01) return 'ok'
  if (ece <= crop.ec90) return 'debt'
  return 'loss'
}

/**
 * Salt Debt gauge: root-zone ECe on a scale from 0 to 1.6 × the 90 % yield ECe.
 * Green up to the crop's target, amber up to the 90 % yield point, red beyond.
 */
export function SaltGauge({
  ece,
  crop,
  target,
  label = 'Salt debt',
  compact = false,
}: {
  ece: number
  crop: Crop
  target: number
  label?: string
  compact?: boolean
}) {
  const max = Math.max(crop.ec90 * 1.6, ece * 1.05)
  const p = (x: number) => `${Math.min(100, (x / max) * 100)}%`
  const zone = debtZone(ece, crop, target)
  const delta = ece - target
  const text =
    zone === 'ok'
      ? `Paid up · ${one(-delta)} dS/m headroom`
      : zone === 'debt'
        ? `In debt · ${one(delta)} dS/m over the limit`
        : `Yield falling · ${one(delta)} dS/m over`
  const color = zone === 'ok' ? 'text-green-ok' : zone === 'debt' ? 'text-[#9a5d12]' : 'text-red-debt'
  return (
    <div className="w-full" role="img" aria-label={`${label}: root-zone salinity ${one(ece)} dS/m, limit ${one(target)} dS/m. ${text}.`}>
      {!compact && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-ink/70">{label}</span>
          <span className={`text-xs font-semibold ${color}`}>{text}</span>
        </div>
      )}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-sand-200">
        <div className="absolute inset-y-0 left-0 bg-green-ok/70" style={{ width: p(target) }} />
        <div
          className="absolute inset-y-0 bg-amber-warn/70"
          style={{ left: p(target), width: `calc(${p(crop.ec90)} - ${p(target)})` }}
        />
        <div className="absolute inset-y-0 right-0 bg-red-debt/70" style={{ left: p(crop.ec90) }} />
      </div>
      <div className="relative h-5">
        <div
          className="absolute -top-[18px] h-6 w-1.5 -translate-x-1/2 rounded-full bg-ink shadow-[0_0_0_2px_var(--color-salt)] transition-[left] duration-300"
          style={{ left: p(ece) }}
        />
        <span className="absolute top-1 -translate-x-1/2 font-mono text-[10px] text-ink/70 transition-[left] duration-300" style={{ left: p(ece) }}>
          {one(ece)}
        </span>
        {ece / max < 0.8 && <span className="absolute top-1 right-0 font-mono text-[10px] text-ink/65">dS/m</span>}
      </div>
    </div>
  )
}

export function Stat({ value, label, sub, tone = 'ink' }: { value: ReactNode; label: string; sub?: ReactNode; tone?: 'ink' | 'teal' | 'red' | 'green' }) {
  const tones = { ink: 'text-ink', teal: 'text-teal-water', red: 'text-red-debt', green: 'text-green-ok' }
  return (
    <div>
      <p className={`font-display text-3xl leading-none tabular ${tones[tone]}`}>{value}</p>
      <p className="mt-1.5 text-xs font-semibold text-ink/70">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink/65">{sub}</p>}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'quiet'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const v = {
    primary: 'bg-teal-water text-salt hover:bg-teal-deep',
    ghost: 'bg-transparent text-teal-water ring-1 ring-teal-water/30 hover:bg-teal-water/5',
    quiet: 'bg-sand-200/70 text-ink hover:bg-sand-200',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${v[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
