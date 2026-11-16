/**
 * The decision: how many minutes to open each valve, day by day, and when to repay the salt debt.
 *
 * Namak policy
 *  1. Maintenance: every day apply ETc / ((1 − LF) × efficiency) (FAO-29 eq. 7), where LF holds the root zone at the
 *     FAO-29 target ECe at steady state under the four-layer concentration-factor method (FAO 1985b = FAO-29; the
 *     same model as FAO-61 Annex 4 Table A4.1). FAO-29 eq. 9 (Rhoades) is its quick estimate and is shown in the UI
 *     for comparison; using the layered value keeps the daily plan consistent with the salt-debt model.
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
  seasonLength,
  climateAdjustedKc,
  kcForDay,
  targetECe,
  type Crop,
  type CropId,
  type Stage,
} from './crops'
import {
  averageECe,
  leachingFractionForTarget,
  maxECwForLF,
  quarterWfc,
  repaymentDepth,
  rootZoneFromECe,
  stepDay,
  type RootZone,
} from './salt'
import {
  depthToLitres,
  etc as etcOf,
  grossDepth,
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
  const blend = modelBlendAdvice(farm.wellEC, farm.cleanEC, target)
  return { ec: blend.needed && farm.canBlend ? blend.blendEC : farm.wellEC, blend }
}

/** Maintenance leaching fraction: FAO-29 concentration-factor method, consistent with the salt model. */
export function maintenanceLF(ecw: number, target: number): number {
  return leachingFractionForTarget(ecw, target)
}

/** Blend advice using the same steady-state model as the planner (LF above LR_PRACTICAL_MAX → blend). */
export function modelBlendAdvice(ecWell: number, ecClean: number, target: number): BlendAdvice {
  const lrWellOnly = maintenanceLF(ecWell, target)
  const ecMax = maxECwForLF(target, LR_PRACTICAL_MAX)
  if (lrWellOnly <= LR_PRACTICAL_MAX || ecWell <= ecMax) {
    return { needed: false, cleanFraction: 0, blendEC: ecWell, lrWithBlend: lrWellOnly, lrWellOnly }
  }
  const x = ecWell - ecClean <= 0 ? 1 : Math.min(1, (ecWell - ecMax) / (ecWell - ecClean))
  const blendEC = (1 - x) * ecWell + x * ecClean
  return { needed: true, cleanFraction: x, blendEC, lrWithBlend: maintenanceLF(blendEC, target), lrWellOnly }
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
  const lrRaw = maintenanceLF(ec, target)
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
  opts: { urgentWindow?: number; headroom?: number; maxRepayFactor?: number } = {},
): { days: ValveDay[]; rzEnd: RootZone } {
  const crop = cropOf(v)
  const { ec } = appliedWater(farm, crop)
  const start = rz0 ?? initialRootZone(farm, v, ec)
  const urgentWindow = opts.urgentWindow ?? 7
  const headroom = opts.headroom ?? 0.95
  // A repayment day applies at most (1 + maxRepayFactor) × the maintenance water, so the debt is spread over the
  // coolest days of the week instead of flooding one valve (FAO-29: timing "does not appear to be critical provided
  // crop tolerance is not exceeded for extended or critical periods").
  const maxRepayFactor = opts.maxRepayFactor ?? 1
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
  const target = dem[0]?.target ?? crop.ecThreshold
  const startsInDebt = averageECe(start) > target + 0.01
  const dayCap = (i: number) => Math.min(maxGross, dem[i].maintGross * (1 + maxRepayFactor))
  const hasRoom = (i: number) => dem[i].maintGross + extra[i] < dayCap(i) - 0.01
  // Done when the root zone is at or below target from some day onward and stays there to the end of the window.
  const tol = 0.01 // dS/m
  const settled = (out: { eceEnd: number }[]) => {
    const f = startsInDebt ? out.findIndex((o) => o.eceEnd <= target + tol) : 0
    return f >= 0 && out.slice(f).every((o) => o.eceEnd <= target + tol)
  }

  for (let pass = 0; pass < days.length * 2; pass++) {
    const { out } = simulate()
    if (settled(out)) break
    // Candidate days: in debt now → the first `urgentWindow` days (whole window if those are full);
    // otherwise any day up to the first projected breach.
    const breach = out.findIndex((o) => o.eceEnd > target + tol)
    const urgentLast = Math.min(days.length - 1, urgentWindow - 1)
    let last = startsInDebt ? urgentLast : Math.max(breach, 0)
    if (!Array.from({ length: last + 1 }, (_, i) => i).some(hasRoom)) last = days.length - 1
    let best = -1
    for (let i = 0; i <= last; i++) {
      if (!hasRoom(i)) continue
      if (best < 0 || days[i].et0 < days[best].et0) best = i
    }
    if (best < 0) break
    const baseIw = (dem[best].maintGross + extra[best]) * farm.efficiency
    const need = repaymentDepth(out[best].rzBefore, baseIw, ec, dem[best].etc, target * headroom)
    const room = Math.max(0, dayCap(best) - dem[best].maintGross - extra[best])
    // If this day is already below target (debt sits later), top it up anyway: earlier leaching lowers later ECe.
    const addGross = need > 0 && Number.isFinite(need) ? need / farm.efficiency : room
    const add = Math.min(addGross, room)
    if (add <= 0.01) {
      extra[best] = dayCap(best) - dem[best].maintGross // mark full so the next pass moves on
      continue
    }
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
 * Days to replay for a valve: perennials get the last 12 months of the data; annual crops get their most recent
 * complete-or-current season, re-planted on the same month-day as `plantingDate` in the year the data covers.
 */
export function replayWindow(v: Valve, days: WeatherDay[]): WeatherDay[] {
  const crop = cropOf(v)
  if (crop.perennial || !v.plantingDate || days.length === 0) return days.slice(-365)
  const md = v.plantingDate.slice(5)
  const last = days[days.length - 1].date
  const len = seasonLength(crop)
  for (let y = Number(last.slice(0, 4)); y >= Number(days[0].date.slice(0, 4)); y--) {
    const start = `${y}-${md}`
    if (start < days[0].date) continue
    if (dayIndex(start) + len - 1 > dayIndex(last)) continue
    return days.filter((d) => d.date >= start && dayIndex(d.date) < dayIndex(start) + len)
  }
  return days.slice(-len)
}

/** Planting date used for a replayed annual crop (first replayed day). */
export function replayValve(v: Valve, days: WeatherDay[]): Valve {
  const w = replayWindow(v, days)
  return cropOf(v).perennial || !v.plantingDate || !w.length ? v : { ...v, plantingDate: w[0].date }
}

/**
 * Season replay: Namak re-plans every day with the next 7 days of (historical) weather as its forecast and applies
 * day 1; Habit runs its fixed minutes. Both start from the same root zone.
 */
export function replaySeason(farm: Farm, v: Valve, allDays: WeatherDay[], horizon = 7) {
  const crop = cropOf(v)
  const days = replayWindow(v, allDays)
  v = replayValve(v, allDays)
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
