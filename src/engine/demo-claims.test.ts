/**
 * The pitch claims, checked against the bundled REAL weather (ERA5 via Open-Meteo, last ~13 months at Al Ain)
 * for the ILLUSTRATIVE demo farm. If a change to the engine breaks a claim we make on stage, this fails.
 */
import { describe, expect, it } from 'vitest'
import { DEMO_FARM } from '../data/demoFarm'
import era5 from '../data/snapshot-era5.json'
import { replaySeason, totals, type WeatherDay } from './plan'

const days = era5.days as WeatherDay[]
const runs = DEMO_FARM.valves.map((v) => {
  const r = replaySeason(DEMO_FARM, v, days)
  return { v, namak: totals(DEMO_FARM, v, r.namak), habit: totals(DEMO_FARM, v, r.habit), r }
})

describe('demo farm on a real year of Al Ain weather', () => {
  it('uses at least 10 % less water than the habit across the farm', () => {
    const n = runs.reduce((a, x) => a + x.namak.litres, 0)
    const h = runs.reduce((a, x) => a + x.habit.litres, 0)
    expect(n / h).toBeLessThan(0.9)
  })

  it('keeps every crop at full salt-limited yield, while the habit loses tomato yield', () => {
    for (const x of runs) expect(x.namak.yieldPct).toBeGreaterThanOrEqual(99.5)
    const tomato = runs.find((x) => x.v.cropId === 'tomato')!
    expect(tomato.habit.yieldPct).toBeLessThan(95)
  })

  it('meets crop water demand every day', () => {
    for (const x of runs) expect(x.namak.waterMet).toBeGreaterThan(0.99)
  })

  it('the habit lets palm salinity climb above tolerance in summer', () => {
    const palms = runs.find((x) => x.v.cropId === 'date-palm')!
    const peak = Math.max(...palms.r.habit.map((d) => d.eceEnd))
    expect(peak).toBeGreaterThan(4.0)
    expect(Math.max(...palms.r.namak.map((d) => d.eceEnd))).toBeLessThan(4.2)
  })
})
