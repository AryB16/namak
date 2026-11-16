/**
 * Simple in-memory rate limits so a public demo cannot burn the API balance.
 *  - per IP and route: `perMinute` calls in any rolling minute
 *  - per server instance: AI_DAILY_CAP calls per UTC day across all routes (default 300)
 * In-memory state resets when the serverless instance is recycled; this is a guard rail, not billing control.
 * When a limit trips, the client falls back to its offline template / browser voice / manual entry.
 */

const hits = new Map<string, number[]>()
let day = ''
let dayCount = 0

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  return (xf?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

export function checkLimit(req: Request, route: string, perMinute: number): { ok: true } | { ok: false; reason: string } {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== day) {
    day = today
    dayCount = 0
  }
  const cap = Number(process.env.AI_DAILY_CAP || 300)
  if (dayCount >= cap) return { ok: false, reason: 'daily AI limit reached' }

  const key = `${route}:${clientIp(req)}`
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= perMinute) {
    hits.set(key, recent)
    return { ok: false, reason: 'too many requests — try again in a minute' }
  }
  recent.push(now)
  hits.set(key, recent)
  dayCount++
  if (hits.size > 5000) hits.clear()
  return { ok: true }
}
