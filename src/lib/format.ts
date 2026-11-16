const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export const int = (n: number) => nf0.format(Math.round(n))
export const one = (n: number) => nf1.format(n)

/** Litres, switching to m³ above 10 000 L. */
export function litres(l: number): string {
  if (Math.abs(l) >= 10_000) return `${nf1.format(l / 1000)} m³`
  return `${int(l)} L`
}

export function m3(l: number): string {
  return `${int(l / 1000)} m³`
}

export function aed(x: number): string {
  return `AED ${int(x)}`
}

export function minutes(m: number): string {
  const r = Math.round(m)
  if (r < 60) return `${r} min`
  const h = Math.floor(r / 60)
  const mm = r % 60
  return mm ? `${h} h ${String(mm).padStart(2, '0')} min` : `${h} h`
}

export function dayLabel(iso: string, style: 'short' | 'long' = 'short'): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    timeZone: 'UTC',
  })
}

export function weekday(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

export function timeAgo(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export const pct = (x: number) => `${Math.round(x * 100)}%`
