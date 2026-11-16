// Fetches real Open-Meteo data for the demo farm and writes it as the offline snapshot bundled with the app.
// Usage: node scripts/snapshot-weather.mjs
import { writeFileSync } from 'node:fs'

const LAT = 24.21
const LON = 55.74
const DAILY = 'et0_fao_evapotranspiration,temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_mean,sunrise'
const u2 = (w) => (w == null ? undefined : +((w * 4.87) / Math.log(67.8 * 10 - 5.42)).toFixed(3))

function parse(d) {
  return d.time
    .map((date, i) => ({
      date,
      et0: d.et0_fao_evapotranspiration[i],
      tmax: d.temperature_2m_max[i] ?? undefined,
      rhMin: d.relative_humidity_2m_min[i] ?? undefined,
      u2: u2(d.wind_speed_10m_mean[i]),
      sunrise: d.sunrise[i]?.slice(11, 16),
    }))
    .filter((x) => x.et0 != null)
}

const iso = (d) => d.toISOString().slice(0, 10)
const now = new Date()
const end = new Date(now.getTime() - 6 * 86400000)
const start = new Date(end.getTime() - 410 * 86400000)

const fc = await (
  await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=${DAILY}&timezone=auto&forecast_days=8&wind_speed_unit=ms`,
  )
).json()
const ar = await (
  await fetch(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${iso(start)}&end_date=${iso(end)}&daily=${DAILY}&timezone=auto&wind_speed_unit=ms&models=era5`,
  )
).json()

const fetchedAt = now.toISOString()
writeFileSync('src/data/snapshot-forecast.json', JSON.stringify({ lat: LAT, lon: LON, fetchedAt, days: parse(fc.daily) }))
writeFileSync('src/data/snapshot-era5.json', JSON.stringify({ lat: LAT, lon: LON, fetchedAt, days: parse(ar.daily) }))
console.log('forecast days', fc.daily.time.length, 'era5 days', ar.daily.time.length, iso(start), '→', iso(end))
