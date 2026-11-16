/**
 * The decision: how many minutes to open each valve, day by day, and when to repay the salt debt.
 *
 * Namak policy
 *  1. Maintenance: every day apply ETc / ((1 − LR) × efficiency) (FAO-29 eqs. 7 and 9) with the FAO-29 target ECe.
 *  2. Salt Debt: track the root zone with the FAO-61 Annex 4 salt storage model (salt.ts).
 *  3. Repayment: when the root zone is (or is projected to be) above the target ECe, schedule one extra leaching
 *     irrigation on the lowest-ET0 day available. FAO-29 §2.4.2: "Leaching can be done at each irrigation, each
 *     alternate irrigation or less frequently, such as seasonally ... as necessary to keep salinity below the
 *     threshold"; "schedule leachings at periods of low crop water use"; "leach during the cool season instead of
 *     the warm ... since the ET losses are lower".
 *
 * Habit baseline: the same fixed minutes on every valve, every day, no salt adjustment.
 */
import {
  CROPS,
  LR_PRACTICAL_MAX,
  climateAdjustedKc,
  kcForDay,
  targetECe,
  type Crop,
  type CropId,
  type Stage,
} from './crops'
import { averageECe, quarterWfc, repaymentDepth, rootZoneFromECe, stepDay, type RootZone } from './salt'
import {
  blendAdvice,
  depthToLitres,
  etc as etcOf,
  grossDepth,
  leachingRequirement,
  litresForMinutes,
  valveMinutes,
  yieldPercent,
  type BlendAdvice,
} from './water'

export interface Valve {
  id: string
  name: string
  cropId: CropId
  emitters: number
  /** Emitter flow, L/h. */
  emitterLph: number
  plants: number
  /** Crop area per plant, m². */
  spacingM2: number
  /** ISO date the annual crop was planted (ignored for perennials). */
  plantingDate?: string
  /** Last known root-zone salinity, ECe dS/m (soil test or model). */
  soilECe: number
  /** The worker's habit for this valve, minutes per day (falls back to the farm's habit). */
  habitMinutes?: number
}

export interface Farm {
  name: string
  place: string
  lat: number
  lon: number
  /** Well water EC, dS/m. */
  wellEC: number
  /** EC of the cleaner water available for blending (desalinated or treated wastewater), dS/m. */
  cleanEC: number
  /** Whether the farm can blend in cleaner water. */
  canBlend: boolean
  /** Cost of water at the valve, AED per m³ (pumping/energy or purchase). */
  waterCostAedM3: number
  efficiency: number
  thetaFc: number
  /** The worker's current habit: minutes per valve per day. */
  habitMinutes: number
  /** Longest a valve may run in one day, minutes. */
  maxValveMinutes: number
  valves: Valve[]
}

export interface WeatherDay {
  date: string // YYYY-MM-DD
  et0: number // mm/day
  tmax?: number
  rhMin?: number // %
  u2?: number // m/s at 2 m
  sunrise?: string // HH:MM local
}

export interface ValveDay {
  date: string
  et0: number
  kc: number
  stage: Stage
  etc: number
  lr: number
  lrCapped: boolean
  /** EC of the water actually applied (well or blend). */
  ecApplied: number
  maintenanceMm: number
  repaymentMm: number
  grossMm: number
  litres: number
  minutes: number
  /** Minutes the valve would need without the per-day cap. */
  capped: boolean
  isRepaymentDay: boolean
  eceStart: number
  eceEnd: number
  target: number
  drainageMm: number
}

export const dayIndex = (iso: string) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86_400_000)

export function valveArea(v: Valve): number {
  return v.plants * v.spacingM2
}

export function cropOf(v: Valve): Crop {
  return CROPS[v.cropId]
}

export function dayAfterPlanting(v: Valve, date: string): number {
  if (!v.plantingDate) return 0
  return dayIndex(date) - dayIndex(v.plantingDate)
}

export function kcFor(v: Valve, day: WeatherDay): { kc: number; stage: Stage } {
  const crop = cropOf(v)
  const { kc, stage } = kcForDay(crop, dayAfterPlanting(v, day.date))
  if (day.u2 === undefined || day.rhMin === undefined) return { kc, stage }
  return { kc: climateAdjustedKc(kc, stage, crop, day.u2, day.rhMin), stage }
}

/** Water the valve's crop is given: blended if the farm can and the well alone is beyond the practical LR. */
export function appliedWater(farm: Farm, crop: Crop): { ec: number; blend: BlendAdvice } {
  const target = targetECe(crop, farm.wellEC)
  const blend = blendAdvice(farm.wellEC, farm.cleanEC, target)
  return { ec: blend.needed && farm.canBlend ? blend.blendEC : farm.wellEC, blend }
}

export function initialRootZone(farm: Farm, v: Valve, ecApplied: number): RootZone {
  return rootZoneFromECe(v.soilECe, ecApplied, quarterWfc(cropOf(v).rootDepthM, farm.thetaFc))
}

interface DayDemand {
  kc: number
  stage: Stage
  etc: number
  lr: number
  lrCapped: boolean
  target: number
  maintIw: number
  maintGross: number
}

function demand(farm: Farm, v: Valve, day: WeatherDay, ec: number): DayDemand {
  const crop = cropOf(v)
  const { kc, stage } = kcFor(v, day)
  const e = etcOf(kc, day.et0)
  const target = targetECe(crop, ec)
  const lrRaw = leachingRequirement(ec, target)
  const lrCapped = !(lrRaw <= LR_PRACTICAL_MAX)
  const lr = lrCapped ? LR_PRACTICAL_MAX : lrRaw
  const maintGross = grossDepth(e, lr, farm.efficiency)
  return { kc, stage, etc: e, lr, lrCapped, target, maintGross, maintIw: maintGross * farm.efficiency }
}

/**
 * Plan one valve over a window of forecast days, starting from root zone `rz0`.
 * Repayment is placed on the lowest-ET0 day that comes before (or on) the day the debt would otherwise breach the
 * target; if the root zone is already above target, within the first `urgentWindow` days.
 */
export function planValve(
  farm: Farm,
  v: Valve,
  days: WeatherDay[],
  rz0?: RootZone,
  opts: { urgentWindow?: number; headroom?: number } = {},
): { days: ValveDay[]; rzEnd: RootZone } {
  const crop = cropOf(v)
  const { ec } = appliedWater(farm, crop)
  const start = rz0 ?? initialRootZone(farm, v, ec)
  const urgentWindow = opts.urgentWindow ?? 3
  const headroom = opts.headroom ?? 0.95
  const area = valveArea(v)
  const flow = v.emitters * v.emitterLph
  const maxGross = flow > 0 && area > 0 ? (litresForMinutes(farm.maxValveMinutes, v.emitters, v.emitterLph) / area) : Infinity
  const dem = days.map((d) => demand(farm, v, d, ec))
  const extra = days.map(() => 0)

  const simulate = () => {
    let rz = start
    const out: { eceStart: number; eceEnd: number; drainage: number; rzBefore: RootZone }[] = []
    for (let i = 0; i < days.length; i++) {
      const gross = Math.min(dem[i].maintGross + extra[i], Math.max(maxGross, dem[i].maintGross))
      const before = rz
      const r = stepDay(rz, gross * farm.efficiency, ec, dem[i].etc)
      out.push({ eceStart: averageECe(before), eceEnd: averageECe(r.rz), drainage: r.drainage, rzBefore: before })
      rz = r.rz
    }
    return { out, rz }
  }

  // Repayment passes: when the daily valve cap limits one repayment, the rest spills onto the next-coolest day.
  for (let pass = 0; pass < days.length; pass++) {
    const { out } = simulate()
    const target = dem[0]?.target ?? crop.ecThreshold
    const already = out.length > 0 && out[0].eceStart > target
    const breach = out.findIndex((o) => o.eceEnd > target)
    if (breach < 0 && !already) break
    const urgentLast = Math.min(days.length - 1, urgentWindow - 1)
    const hasRoom = (i: number) => dem[i].maintGross + extra[i] < maxGross - 0.01
    // Prefer the urgent window; if every day in it is at capacity, look further ahead.
    const windowFull = already && !Array.from({ length: urgentLast + 1 }, (_, i) => i).some(hasRoom)
    const last = already ? (windowFull ? days.length - 1 : urgentLast) : Math.max(breach, 0)
    let best = -1
    for (let i = 0; i <= last; i++) {
      if (!hasRoom(i)) continue
      if (best < 0 || days[i].et0 < days[best].et0) best = i
    }
    if (best < 0) break
    const o = out[best]
    const baseIw = (dem[best].maintGross + extra[best]) * farm.efficiency
    const need = repaymentDepth(o.rzBefore, baseIw, ec, dem[best].etc, dem[best].target * headroom)
    if (need <= 0) break
    const addGross = Number.isFinite(need) ? need / farm.efficiency : maxGross
    const room = Math.max(0, maxGross - dem[best].maintGross - extra[best])
    const add = Math.min(addGross, room)
    if (add <= 0.01) break
    extra[best] += add
  }

  const { out, rz } = simulate()
  const result: ValveDay[] = days.map((d, i) => {
    const want = dem[i].maintGross + extra[i]
    const gross = Math.min(want, Math.max(maxGross, dem[i].maintGross))
    const litres = depthToLitres(gross, area)
    return {
      date: d.date,
      et0: d.et0,
      kc: dem[i].kc,
      stage: dem[i].stage,
      etc: dem[i].etc,
      lr: dem[i].lr,
      lrCapped: dem[i].lrCapped,
      ecApplied: ec,
      maintenanceMm: dem[i].maintGross,
      repaymentMm: gross - dem[i].maintGross,
      grossMm: gross,
      litres,
      minutes: valveMinutes(litres, v.emitters, v.emitterLph),
      capped: want > gross + 1e-9,
      isRepaymentDay: extra[i] > 0.01,
      eceStart: out[i].eceStart,
      eceEnd: out[i].eceEnd,
      target: dem[i].target,
      drainageMm: out[i].drainage,
    }
  })
  return { days: result, rzEnd: rz }
}

/** Habit: fixed minutes every day, well water, no salt adjustment. */
export function habitValve(farm: Farm, v: Valve, days: WeatherDay[], rz0?: RootZone): { days: ValveDay[]; rzEnd: RootZone } {
  const crop = cropOf(v)
  const ec = farm.wellEC
  let rz = rz0 ?? initialRootZone(farm, v, ec)
  const area = valveArea(v)
  const habitMin = v.habitMinutes ?? farm.habitMinutes
  const litres = litresForMinutes(habitMin, v.emitters, v.emitterLph)
  const gross = area > 0 ? litres / area : 0
  const out = days.map((d) => {
    const { kc, stage } = kcFor(v, d)
    const e = etcOf(kc, d.et0)
    const eceStart = averageECe(rz)
    const r = stepDay(rz, gross * farm.efficiency, ec, e)
    rz = r.rz
    const vd: ValveDay = {
      date: d.date,
      et0: d.et0,
      kc,
      stage,
      etc: e,
      lr: 0,
      lrCapped: false,
      ecApplied: ec,
      maintenanceMm: gross,
      repaymentMm: 0,
      grossMm: gross,
      litres,
      minutes: habitMin,
      capped: false,
      isRepaymentDay: false,
      eceStart,
      eceEnd: averageECe(rz),
      target: targetECe(crop, ec),
      drainageMm: r.drainage,
    }
    return vd
  })
  return { days: out, rzEnd: rz }
}

export interface ValveSchedule {
  valveId: string
  start: string // HH:MM
  end: string
  minutes: number
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Pre-dawn schedule: valves run one after another (one pump) and finish by sunrise, but never start before
 * `earliest`. Rationale (design choice, not an FAO number): water applied before sunrise is in the root zone
 * before the afternoon peak in demand, and evaporation and wind losses from wet surfaces are lowest at night.
 */
export function predawnSchedule(
  items: { valveId: string; minutes: number }[],
  sunrise = '06:15',
  earliest = '03:00',
): ValveSchedule[] {
  const total = items.reduce((a, b) => a + Math.ceil(b.minutes), 0)
  let t = Math.max(toMin(earliest), toMin(sunrise) - total)
  return items.map((it) => {
    const mins = Math.ceil(it.minutes)
    const s = { valveId: it.valveId, start: toHHMM(t), end: toHHMM(t + mins), minutes: mins }
    t += mins
    return s
  })
}

export interface SummaryTotals {
  litres: number
  costAed: number
  meanECe: number
  endECe: number
  yieldPct: number
  /** Share of crop water demand that was met (1 = fully met). */
  waterMet: number
}

/** Totals for a set of valve-days of one valve. Yield uses the mean root-zone ECe over the period (FAO-56 §8). */
export function totals(farm: Farm, v: Valve, days: ValveDay[]): SummaryTotals {
  const crop = cropOf(v)
  const litres = days.reduce((a, d) => a + d.litres, 0)
  const meanECe = days.length ? days.reduce((a, d) => a + d.eceEnd, 0) / days.length : v.soilECe
  const demandMm = days.reduce((a, d) => a + d.etc, 0)
  const metMm = days.reduce((a, d) => a + Math.min(d.etc, d.grossMm * farm.efficiency), 0)
  return {
    litres,
    costAed: (litres / 1000) * farm.waterCostAedM3,
    meanECe,
    endECe: days.length ? days[days.length - 1].eceEnd : v.soilECe,
    yieldPct: yieldPercent(meanECe, crop),
    waterMet: demandMm > 0 ? metMm / demandMm : 1,
  }
}

/**
 * Season replay: Namak re-plans every day with the next 7 days of (historical) weather as its forecast and applies
 * day 1; Habit runs its fixed minutes. Both start from the same root zone.
 */
export function replaySeason(farm: Farm, v: Valve, days: WeatherDay[], horizon = 7) {
  const crop = cropOf(v)
  const { ec } = appliedWater(farm, crop)
  let rz = initialRootZone(farm, v, ec)
  const namak: ValveDay[] = []
  for (let i = 0; i < days.length; i++) {
    const window = days.slice(i, i + horizon)
    const p = planValve(farm, v, window, rz)
    namak.push(p.days[0])
    rz = stepDay(rz, p.days[0].grossMm * farm.efficiency, ec, p.days[0].etc).rz
  }
  const habit = habitValve(farm, v, days, initialRootZone(farm, v, farm.wellEC)).days
  return { namak, habit }
}
