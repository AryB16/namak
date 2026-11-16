import { describe, expect, it } from 'vitest'
import { DEMO_FARM } from '../data/demoFarm'
import era5 from '../data/snapshot-era5.json'
import fc from '../data/snapshot-forecast.json'
import { compareYear, planFarm } from './farm'
import type { WeatherDay } from './plan'

const year = era5.days as WeatherDay[]

describe('compareYear (slider engine)', () => {
  it('saves water for the demo farm', () => {
    const c = compareYear(DEMO_FARM, year)
    expect(c.savedLitres).toBeGreaterThan(0)
    expect(c.saltLitres).toBeGreaterThan(0)
  })
  it('saltier well → more water spent on salt', () => {
    const a = compareYear({ ...DEMO_FARM, wellEC: 2 }, year).saltLitres
    const b = compareYear({ ...DEMO_FARM, wellEC: 5 }, year).saltLitres
    expect(b).toBeGreaterThan(a)
  })
  it('very salty well without blending → Namak flags capped leaching and yield risk on tomato', () => {
    const c = compareYear({ ...DEMO_FARM, wellEC: 6, canBlend: false }, year)
    const t = c.valves.find((v) => v.valve.cropId === 'tomato')!
    expect(t.lfCapped).toBe(true)
    expect(t.namakYield).toBeLessThan(100)
  })
  it('monthly totals add up to the yearly totals', () => {
    const c = compareYear(DEMO_FARM, year)
    const n = c.monthly.reduce((a, m) => a + m.namakL, 0)
    const h = c.monthly.reduce((a, m) => a + m.habitL, 0)
    expect(n).toBeCloseTo(c.namakLitres, 0)
    expect(h).toBeCloseTo(c.habitLitres, 0)
    expect(c.monthly.length).toBeGreaterThanOrEqual(12)
  })
  it('fast enough for a slider (< 50 ms)', () => {
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) compareYear({ ...DEMO_FARM, wellEC: 1 + i }, year)
    expect((performance.now() - t0) / 5).toBeLessThan(50)
  })
})

describe('planFarm', () => {
  it('schedules valves back to back before sunrise', () => {
    const p = planFarm(DEMO_FARM, (fc.days as WeatherDay[]).slice(1))
    expect(p.schedule).toHaveLength(3)
    expect(p.schedule[1].start).toBe(p.schedule[0].end)
  })
})
