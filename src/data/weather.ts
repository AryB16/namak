/**
 * Weather from Open-Meteo (free, no key, non-commercial licence).
 *  - Forecast API: https://api.open-meteo.com/v1/forecast  (docs: open-meteo.com/en/docs)
 *  - Historical API, ERA5 reanalysis only (models=era5): https://archive-api.open-meteo.com/v1/archive
 *    (docs: open-meteo.com/en/docs/historical-weather-api — ERA5, 0.25°, daily with ~5 days delay)
 * Daily variables: et0_fao_evapotranspiration (mm, FAO-56 Penman-Monteith), temperature_2m_max (°C),
 * relative_humidity_2m_min (%), wind_speed_10m_mean (m/s, converted to 2 m with FAO-56 eq. 47), sunrise.
 *
 * Every successful response is cached in localStorage. If a fetch fails we return the last cached copy (stale),
 * and if there is none, a snapshot bundled with the app (also real Open-Meteo data, fetched at build time).
 */
import { windAt2m } from '../engine/crops'
import type { WeatherDay } from '../engine/plan'

export type WeatherSource = 'live' | 'cache' | 'snapshot'

export interface WeatherResult {
  days: WeatherDay[]
  source: WeatherSource
  /** When the data was fetched from Open-Meteo (ISO). */
  fetchedAt: string
  label: string
}

interface OpenMeteoDaily {
  time: string[]
  et0_fao_evapotranspiration: (number | null)[]
  temperature_2m_max: (number | null)[]
  relative_humidity_2m_min: (number | null)[]
  wind_speed_10m_mean: (number | null)[]
  sunrise: string[]
}

const DAILY = 'et0_fao_evapotranspiration,temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_mean,sunrise'

export function forecastUrl(lat: number, lon: number, days = 8): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&daily=${DAILY}&timezone=auto&forecast_days=${days}&wind_speed_unit=ms`
  )
}

export function archiveUrl(lat: number, lon: number, start: string, end: string): string {
  return (
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&start_date=${start}&end_date=${end}&daily=${DAILY}&timezone=auto&wind_speed_unit=ms&models=era5`
  )
}

/** Convert an Open-Meteo daily block to engine WeatherDays; days without ET0 are dropped. */
export function parseDaily(daily: OpenMeteoDaily): WeatherDay[] {
  const out: WeatherDay[] = []
  daily.time.forEach((date, i) => {
    const et0 = daily.et0_fao_evapotranspiration[i]
    if (et0 === null || et0 === undefined) return
    const w = daily.wind_speed_10m_mean?.[i]
    const rh = daily.relative_humidity_2m_min?.[i]
    const tmax = daily.temperature_2m_max?.[i]
    out.push({
      date,
      et0,
      tmax: tmax ?? undefined,
      rhMin: rh ?? undefined,
      u2: w === null || w === undefined ? undefined : windAt2m(w),
      sunrise: daily.sunrise?.[i]?.slice(11, 16) || undefined,
    })
  })
  return out
}

const KEY = 'namak.weather.v1:'

function readCache(key: string): { days: WeatherDay[]; fetchedAt: string } | null {
  try {
    const raw = localStorage.getItem(KEY + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(key: string, value: { days: WeatherDay[]; fetchedAt: string }) {
  try {
    localStorage.setItem(KEY + key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: carry on without cache */
  }
}

async function fetchDaily(url: string, timeoutMs = 9000): Promise<WeatherDay[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    const json = await res.json()
    if (!json.daily) throw new Error('Open-Meteo: no daily data')
    const days = parseDaily(json.daily)
    if (days.length === 0) throw new Error('Open-Meteo: empty')
    return days
  } finally {
    clearTimeout(t)
  }
}

async function withFallback(
  key: string,
  url: string,
  snapshot: () => Promise<{ days: WeatherDay[]; fetchedAt: string } | null>,
  label: string,
): Promise<WeatherResult> {
  try {
    const days = await fetchDaily(url)
    const fetchedAt = new Date().toISOString()
    writeCache(key, { days, fetchedAt })
    return { days, source: 'live', fetchedAt, label }
  } catch {
    const cached = readCache(key)
    if (cached) return { ...cached, source: 'cache', label }
    const snap = await snapshot()
    if (snap) return { ...snap, source: 'snapshot', label }
    throw new Error('No weather available')
  }
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.05

/** 8 days from today: index 0 is today, index 1 is tomorrow. */
export async function getForecast(lat: number, lon: number): Promise<WeatherResult> {
  return withFallback(
    `fc:${lat.toFixed(2)},${lon.toFixed(2)}`,
    forecastUrl(lat, lon),
    async () => {
      const s = (await import('./snapshot-forecast.json')).default
      return near(s.lat, lat) && near(s.lon, lon) ? { days: s.days as WeatherDay[], fetchedAt: s.fetchedAt } : null
    },
    'Live forecast · Open-Meteo',
  )
}

/** ~13 months of ERA5 ending 6 days ago (the reanalysis delay): a full year plus the start of last winter's season. */
export async function getLastYear(lat: number, lon: number, today = new Date()): Promise<WeatherResult> {
  const end = new Date(today.getTime() - 6 * 86_400_000)
  const start = new Date(end.getTime() - 410 * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return withFallback(
    `era5:${lat.toFixed(2)},${lon.toFixed(2)}:${iso(end).slice(0, 7)}`,
    archiveUrl(lat, lon, iso(start), iso(end)),
    async () => {
      const s = (await import('./snapshot-era5.json')).default
      return near(s.lat, lat) && near(s.lon, lon) ? { days: s.days as WeatherDay[], fetchedAt: s.fetchedAt } : null
    },
    'Historical weather · ERA5 via Open-Meteo',
  )
}

/** Read a cached forecast synchronously (for an instant first paint), if it is less than 36 h old. */
export function peekForecast(lat: number, lon: number): WeatherResult | null {
  const c = readCache(`fc:${lat.toFixed(2)},${lon.toFixed(2)}`)
  if (!c || Date.now() - Date.parse(c.fetchedAt) > 36 * 3_600_000) return null
  return { ...c, source: 'cache', label: 'Live forecast · Open-Meteo' }
}

/** Read the most recent cached ERA5 year synchronously, if any. */
export function peekLastYear(lat: number, lon: number): WeatherResult | null {
  try {
    const prefix = `${KEY}era5:${lat.toFixed(2)},${lon.toFixed(2)}:`
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix)).sort()
    const k = keys[keys.length - 1]
    if (!k) return null
    const c = JSON.parse(localStorage.getItem(k) || 'null') as { days: WeatherDay[]; fetchedAt: string } | null
    return c ? { ...c, source: 'cache', label: 'Historical weather · ERA5 via Open-Meteo' } : null
  } catch {
    return null
  }
}
