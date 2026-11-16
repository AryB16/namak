import { m } from 'motion/react'
import type { ReactNode } from 'react'
import type { Crop } from '../engine/crops'
import { one } from '../lib/format'
import { EASE } from './motion'

export function SourceTag({ children, tone = 'teal' }: { children: ReactNode; tone?: 'teal' | 'sand' | 'amber' }) {
  const dot = { teal: 'bg-teal-water', sand: 'bg-sand-500', amber: 'bg-amber-warn' }[tone]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.045] px-2.5 py-1 text-[12px] font-medium leading-none text-ink/70">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-[28px] p-6 ${className}`}>{children}</section>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-semibold tracking-normal text-teal-water">{children}</p>
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
  label = 'Salt in the soil',
  compact = false,
  dark = false,
}: {
  ece: number
  crop: Crop
  target: number
  label?: string
  compact?: boolean
  dark?: boolean
}) {
  const max = Math.max(crop.ec90 * 1.6, ece * 1.05)
  const pc = (x: number) => Math.min(100, (x / max) * 100)
  const zone = debtZone(ece, crop, target)
  const delta = ece - target
  const text =
    zone === 'ok' ? 'Healthy — below the safe level' : zone === 'debt' ? 'A bit too salty — being washed out' : 'Too salty — crop is suffering'
  const color = dark
    ? zone === 'ok'
      ? 'text-glow-water'
      : 'text-glow-salt'
    : zone === 'ok'
      ? 'text-green-ok'
      : zone === 'debt'
        ? 'text-[#9a5d12]'
        : 'text-red-debt'
  return (
    <div className="w-full" role="img" aria-label={`${label}: ${one(ece)} dS/m, safe level ${one(target)} dS/m. ${text}.`}>
      {!compact && (
        <p className="mb-2.5 text-[14px] leading-snug">
          <span className={dark ? 'text-white/70' : 'text-ink/70'}>{label}: </span>
          <span className={`font-semibold ${color}`}>{text}</span>
        </p>
      )}
      <div className={`relative h-2 w-full rounded-full ${dark ? 'bg-white/10' : 'bg-sand-200'}`}>
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-green-ok/80" style={{ width: `${pc(target)}%` }} />
        <div className="absolute inset-y-0 bg-amber-warn/80" style={{ left: `${pc(target)}%`, width: `${pc(crop.ec90) - pc(target)}%` }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-red-debt/75" style={{ left: `${pc(crop.ec90)}%` }} />
        <m.div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.22)]"
          initial={{ left: '0%' }}
          animate={{ left: `${pc(ece)}%` }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          {compact && (
            <span className={`absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular ${dark ? 'text-white/80' : 'text-ink/70'}`}>
              {one(ece)}
            </span>
          )}
        </m.div>
      </div>
      <div className={compact ? 'h-6' : 'h-3'} />
      {!compact && (
        <p className={`text-[12px] ${dark ? 'text-white/60' : 'text-ink/65'}`}>
          Now {one(ece)} · safe level {one(target)} dS/m · {delta > 0.01 ? `${one(delta)} over` : `${one(-delta)} to spare`}
        </p>
      )}
    </div>
  )
}

export function Stat({ value, label, sub, tone = 'ink' }: { value: ReactNode; label: string; sub?: ReactNode; tone?: 'ink' | 'teal' | 'red' | 'green' }) {
  const tones = { ink: 'text-ink', teal: 'text-teal-water', red: 'text-red-debt', green: 'text-green-ok' }
  return (
    <div>
      <p className={`text-3xl leading-none font-semibold tracking-[-0.03em] tabular ${tones[tone]}`}>{value}</p>
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
    primary: 'bg-teal-water text-white hover:brightness-110',
    ghost: 'bg-transparent text-teal-water ring-1 ring-teal-water/35 hover:bg-teal-water/5',
    quiet: 'bg-black/[0.05] text-ink hover:bg-black/[0.08]',
  }
  return (
    <m.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-[filter,background-color] disabled:opacity-45 ${v[variant]} ${className}`}
    >
      {children}
    </m.button>
  )
}

/** "Results" has two views: the year in numbers (#compare) and the day-by-day replay (#replay). */
export function ResultsSwitch({ current }: { current: 'compare' | 'replay' }) {
  const items = [
    { id: 'compare', label: 'Water saved' },
    { id: 'replay', label: 'Last year replayed' },
  ] as const
  return (
    <nav aria-label="Results" className="inline-flex rounded-full bg-black/[0.05] p-1">
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          aria-current={i.id === current ? 'page' : undefined}
          className={`inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold transition-colors ${i.id === current ? 'bg-white text-ink shadow-[0_1px_4px_rgba(0,0,0,0.12)]' : 'text-ink/65 hover:text-ink'}`}
        >
          {i.label}
        </a>
      ))}
    </nav>
  )
}
