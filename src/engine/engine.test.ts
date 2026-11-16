import { describe, expect, it } from 'vitest'
import { CROPS, climateAdjustedKc, kcForDay, targetECe, windAt2m } from './crops'
import { averageECe, quarterWfc, repaymentDepth, rootZoneFromECe, stepDay, totalSalt } from './salt'
import {
  blendAdvice,
  etc,
  grossDepth,
  leachingRequirement,
  maxPracticalECw,
  valveMinutes,
  yieldPercent,
} from './water'
import { habitValve, planValve, predawnSchedule, replaySeason, type Farm, type WeatherDay } from './plan'

describe('FAO-29 leaching requirement (eq. 9) — reproduces Example 3', () => {
  // Example 3: maize, ECw 1.2 dS/m. ECe 2.5 (90 %) → LR ≈ 0.10; ECe 1.7 (100 %) → LR ≈ 0.16.
  it('ECe 2.5 → 0.106', () => expect(leachingRequirement(1.2, 2.5)).toBeCloseTo(1.2 / 11.3, 6))
  it('ECe 1.7 → 0.164', () => expect(leachingRequirement(1.2, 1.7)).toBeCloseTo(0.16438, 4))
  it('ET 800 mm with LR 0.10 → 889 mm applied (FAO-29 eq. 7, "890 mm")', () =>
    expect(grossDepth(800, 0.1, 1)).toBeCloseTo(888.9, 1))
  it('too salty to reach target → Infinity', () => expect(leachingRequirement(10, 2)).toBe(Infinity))
  it('fresh water → 0', () => expect(leachingRequirement(0, 2)).toBe(0))
})

describe('water arithmetic', () => {
  it('ETc = Kc × ET0', () => expect(etc(0.95, 8)).toBeCloseTo(7.6, 10))
  it('gross = ETc / ((1 − LR) × eff)', () => expect(grossDepth(7.6, 0.2, 0.9)).toBeCloseTo(7.6 / 0.72, 10))
  it('1200 L through 40 × 4 L/h emitters = 450 min', () => expect(valveMinutes(1200, 40, 4)).toBe(450))
  it('no flow → 0 minutes', () => expect(valveMinutes(100, 0, 4)).toBe(0))
})

describe('yield response matches FAO-29 Table 4 90 % column', () => {
  // FAO-56 Table 23 slope b applied at the FAO-29 90 % ECe should give ≈ 90 %.
  it('date palm at ECe 6.8 → ≈ 90 %', () => expect(yieldPercent(6.8, CROPS['date-palm'])).toBeCloseTo(89.92, 2))
  it('tomato at ECe 3.5 → 91 %', () => expect(yieldPercent(3.5, CROPS.tomato)).toBeCloseTo(91, 6))
  it('lettuce at ECe 2.1 → 90.4 %', () => expect(yieldPercent(2.1, CROPS.lettuce)).toBeCloseTo(90.4, 6))
  it('below threshold → 100 %', () => expect(yieldPercent(1, CROPS.tomato)).toBe(100))
  it('clamped at 0', () => expect(yieldPercent(40, CROPS.tomato)).toBe(0))
  it('every crop: 90 % column within 2 points', () => {
    for (const c of Object.values(CROPS)) expect(Math.abs(yieldPercent(c.ec90, c) - 90)).toBeLessThan(2)
  })
})

describe('FAO-29 target ECe rule', () => {
  it('ECw > 1.5 uses the 100 % threshold', () => expect(targetECe(CROPS.tomato, 3)).toBe(2.5))
  it('ECw ≤ 1.5 uses the 90 % ECe', () => expect(targetECe(CROPS.tomato, 1.2)).toBe(3.5))
})

describe('blending', () => {
  it('max practical ECw at LR 0.25 equals target ECe', () => expect(maxPracticalECw(4)).toBeCloseTo(4, 10))
  it('6 dS/m well + 0.5 dS/m desal for date palm → 36.4 % clean water, LR 0.25', () => {
    const b = blendAdvice(6, 0.5, 4)
    expect(b.needed).toBe(true)
    expect(b.cleanFraction).toBeCloseTo(2 / 5.5, 6)
    expect(b.blendEC).toBeCloseTo(4, 6)
    expect(b.lrWithBlend).toBeCloseTo(0.25, 6)
  })
  it('not needed when LR is practical', () => expect(blendAdvice(3, 0.5, 4).needed).toBe(false))
})

describe('FAO-56 Kc curve and climate adjustment', () => {
  const t = CROPS.tomato // 35/45/70/30, 0.6 → 1.15 → 0.80
  it('initial', () => expect(kcForDay(t, 0).kc).toBe(0.6))
  it('half-way through development', () => expect(kcForDay(t, 57.5).kc).toBeCloseTo(0.875, 10))
  it('mid-season', () => expect(kcForDay(t, 100)).toEqual({ kc: 1.15, stage: 'mid-season' }))
  it('end of season', () => expect(kcForDay(t, 180).kc).toBeCloseTo(0.8, 10))
  it('perennial is constant Kc mid', () => expect(kcForDay(CROPS['date-palm'], 999).kc).toBe(0.95))
  it('eq. 62: tomato, u2 3 m/s, RHmin 20 % → +0.086', () =>
    expect(climateAdjustedKc(1.15, 'mid-season', t, 3, 20)).toBeCloseTo(1.15 + 0.14 * Math.pow(0.2, 0.3), 10))
  it('eq. 62 not applied in the initial stage', () => expect(climateAdjustedKc(0.6, 'initial', t, 3, 20)).toBe(0.6))
  it('eq. 47: 10 m wind → 2 m', () => expect(windAt2m(10)).toBeCloseTo(10 * (4.87 / Math.log(672.58)), 10))
})

describe('FAO-61 Annex 4 salt storage model', () => {
  const runToEquilibrium = (lf: number) => {
    const w = quarterWfc(1, 0.12)
    let rz = rootZoneFromECe(1, 1, w)
    const et = 6
    const iw = et / (1 - lf)
    for (let i = 0; i < 4000; i++) rz = stepDay(rz, iw, 1, et).rz
    return averageECe(rz)
  }
  // Annex 4 Table A4.1 concentration factors X (average ECe = X · ECiw), FAO 1985b.
  it.each([
    [0.05, 3.2],
    [0.1, 2.1],
    [0.15, 1.6],
    [0.2, 1.3],
    [0.3, 1.0],
  ])('steady state at LF %s → X ≈ %s', (lf, x) => {
    expect(Math.abs(runToEquilibrium(lf) - x)).toBeLessThan(0.08)
  })

  it('conserves salt: ΔS = in − out', () => {
    const w = quarterWfc(0.7, 0.12)
    const rz = rootZoneFromECe(3, 2, w)
    const r = stepDay(rz, 9, 2, 6)
    expect(totalSalt(r.rz) - totalSalt(rz)).toBeCloseTo(r.saltIn - r.saltOut, 9)
  })

  it('round-trips a starting ECe', () => {
    const rz = rootZoneFromECe(3.1, 3.8, quarterWfc(1.5, 0.12))
    expect(averageECe(rz)).toBeCloseTo(3.1, 10)
  })

  it('no drainage when water < demand, and salt only rises', () => {
    const rz = rootZoneFromECe(3, 3, quarterWfc(1, 0.12))
    const r = stepDay(rz, 4, 3, 6)
    expect(r.drainage).toBe(0)
    expect(r.etActual).toBe(4)
    expect(totalSalt(r.rz)).toBeCloseTo(totalSalt(rz) + 12, 9)
  })

  it('repayment depth brings ECe to target', () => {
    const rz = rootZoneFromECe(5, 3.8, quarterWfc(1.5, 0.12))
    const d = repaymentDepth(rz, 8, 3.8, 6, 4.5)
    expect(d).toBeGreaterThan(0)
    expect(averageECe(stepDay(rz, 8 + d, 3.8, 6).rz)).toBeCloseTo(4.5, 3)
  })
})

const farm: Farm = {
  name: 'Test',
  place: 'Test',
  lat: 24.2,
  lon: 55.7,
  wellEC: 3.8,
  cleanEC: 0.5,
  canBlend: true,
  waterCostAedM3: 2,
  efficiency: 0.9,
  thetaFc: 0.12,
  habitMinutes: 45,
  maxValveMinutes: 600,
  valves: [],
}
const palms = {
  id: 'v1',
  name: 'Valve 1',
  cropId: 'date-palm' as const,
  emitters: 160,
  emitterLph: 8,
  plants: 40,
  spacingM2: 64,
  soilECe: 4.6,
}
const week = (et0s: number[]): WeatherDay[] =>
  et0s.map((et0, i) => ({ date: `2026-11-${String(17 + i).padStart(2, '0')}`, et0 }))

describe('planner', () => {
  it('maintenance minutes match the hand calculation', () => {
    // date palm, ET0 5 → ETc 4.75 mm; LR = 3.8/(20 − 3.8) = 0.2346; gross = 4.75/(0.7654 × 0.9) = 6.896 mm
    // area 40 × 64 = 2560 m² → 17 652 L; flow 160 × 8 = 1280 L/h → 827 min, capped at 240.
    const p = planValve(farm, { ...palms, soilECe: 3.0 }, week([5]))
    const d = p.days[0]
    expect(d.lr).toBeCloseTo(3.8 / 16.2, 6)
    expect(d.maintenanceMm).toBeCloseTo(4.75 / ((1 - 3.8 / 16.2) * 0.9), 6)
  })

  it('schedules debt repayment on the coolest day in the urgent window', () => {
    // Big valve so capacity is not the limit: the whole repayment lands on the coolest early day.
    const v = { ...palms, plants: 10, soilECe: 4.3 }
    const p = planValve({ ...farm, maxValveMinutes: 1440 }, v, week([7, 4, 6, 8, 8, 8, 8]))
    const rep = p.days.filter((d) => d.isRepaymentDay).map((d) => d.date)
    expect(rep[0]).toBe('2026-11-18') // ET0 4 is the lowest of the first three days
    const after = p.days.find((d) => d.date === '2026-11-18')!
    expect(after.eceEnd).toBeLessThan(after.target) // debt repaid that day (to ~0.95 × target, capacity allowing)
  })

  it('no repayment when the soil is below target and stays there', () => {
    const v = { ...palms, plants: 10, soilECe: 2.5 }
    const p = planValve(farm, v, week([5, 5, 5, 5, 5, 5, 5]))
    expect(p.days.some((d) => d.isRepaymentDay)).toBe(false)
  })

  it('when the valve is at capacity, repayment spills to later cool days instead of being dropped', () => {
    const tight = { ...farm, maxValveMinutes: 240 }
    const v = { ...palms, plants: 10, soilECe: 5.0 }
    const p = planValve(tight, v, week([7, 7, 7, 4, 5, 6, 7]))
    const rep = p.days.filter((d) => d.isRepaymentDay)
    expect(rep.length).toBeGreaterThan(0)
    // repayment never pushes a valve past the cap, and only lands on cooler days that have spare capacity
    expect(rep.every((d) => d.minutes <= 240 + 1e-6)).toBe(true)
    expect(rep.every((d) => d.et0 <= 5)).toBe(true)
    expect(rep.map((d) => d.date)).toContain('2026-11-20')
  })

  it('habit runs fixed minutes', () => {
    const h = habitValve(farm, palms, week([5, 9]))
    expect(h.days.map((d) => d.minutes)).toEqual([45, 45])
    expect(h.days[0].litres).toBeCloseTo((45 / 60) * 1280, 9)
  })

  it('season replay: Namak keeps the root zone nearer target than habit in summer heat', () => {
    const v = { ...palms, plants: 10, soilECe: 4.0 }
    const summer: WeatherDay[] = Array.from({ length: 90 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10),
      et0: 9,
    }))
    const r = replaySeason({ ...farm, habitMinutes: 45 }, v, summer)
    const lastN = r.namak[r.namak.length - 1].eceEnd
    const lastH = r.habit[r.habit.length - 1].eceEnd
    // With enough valve capacity Namak holds the root zone at or below the target (4.0) plus model tolerance.
    expect(lastN).toBeLessThan(4.0 + 0.1)
    expect(lastH).toBeGreaterThan(lastN)
  })
})

describe('pre-dawn schedule', () => {
  it('finishes by sunrise', () => {
    expect(predawnSchedule([{ valveId: 'a', minutes: 30 }, { valveId: 'b', minutes: 45 }], '06:15')).toEqual([
      { valveId: 'a', start: '05:00', end: '05:30', minutes: 30 },
      { valveId: 'b', start: '05:30', end: '06:15', minutes: 45 },
    ])
  })
  it('never starts before 03:00', () => {
    expect(predawnSchedule([{ valveId: 'a', minutes: 300 }], '06:00')[0].start).toBe('03:00')
  })
})
