/**
 * Farm-level views built on the per-valve engine: tomorrow's plan, and a fast "year like last year" comparison
 * used by the live well-EC slider.
 */
import { CROPS, LR_PRACTICAL_MAX, targetECe } from './crops'
import {
  appliedWater,
  cropOf,
  habitValve,
  initialRootZone,
  kcFor,
  maintenanceLF,
  planValve,
  predawnSchedule,
  valveArea,
  type Farm,
  type Valve,
  type ValveDay,
  type ValveSchedule,
  type WeatherDay,
} from './plan'
import { averageECe, steadyStateECe, stepDay } from './salt'
import { leachingRequirement, litresForMinutes, yieldPercent, type BlendAdvice } from './water'

export interface ValvePlan {
  valve: Valve
  days: ValveDay[]
  habit: ValveDay[]
  blend: BlendAdvice
  ecApplied: number
  /** Current root-zone ECe (start of plan). */
  eceNow: number
  target: number
  /** FAO-29 eq. 9 leaching requirement, for comparison with the layered LF used. */
  lrEq9: number
}

export interface FarmPlan {
  valves: ValvePlan[]
  /** Pre-dawn schedule for the first day of the plan. */
  schedule: ValveSchedule[]
  days: WeatherDay[]
}

export function planFarm(farm: Farm, days: WeatherDay[]): FarmPlan {
  const valves = farm.valves.map((v): ValvePlan => {
    const { ec, blend } = appliedWater(farm, cropOf(v))
    const p = planValve(farm, v, days)
    const h = habitValve(farm, v, days)
    const target = targetECe(cropOf(v), ec)
    return {
      valve: v,
      days: p.days,
      habit: h.days,
      blend,
      ecApplied: ec,
      eceNow: averageECe(initialRootZone(farm, v, ec)),
      target,
      lrEq9: leachingRequirement(ec, target),
    }
  })
  const schedule = predawnSchedule(
    valves.map((vp) => ({ valveId: vp.valve.id, minutes: vp.days[0]?.minutes ?? 0 })),
    days[0]?.sunrise ?? '06:15',
  )
  return { valves, schedule, days }
}

export interface YearValve {
  valve: Valve
  namakLitres: number
  habitLitres: number
  /** Water that goes to flushing salt (Namak), litres. */
  saltLitres: number
  namakYield: number
  habitYield: number
  habitPeakECe: number
  habitMeanECe: number
  /** Root-zone ECe Namak holds (the target, or higher if leaching had to be capped). */
  namakECe: number
  lf: number
  lfCapped: boolean
  blend: BlendAdvice
  ecApplied: number
  target: number
  /** Crop water demand met by the habit (0–1). */
  habitWaterMet: number
}

export interface YearCompare {
  valves: YearValve[]
  namakLitres: number
  habitLitres: number
  saltLitres: number
  savedLitres: number
  savedAed: number
  days: number
}

/**
 * Fast comparison over a year of real weather: Namak's maintenance plan (which holds the root zone at the crop's
 * target by construction; debt repayment is ignored here) against the habit simulated with the salt model.
 * Cheap enough to run on every slider move.
 */
export function compareYear(farm: Farm, yearDays: WeatherDay[]): YearCompare {
  const days = yearDays.slice(-365)
  const valves = farm.valves.map((v): YearValve => {
    const crop = cropOf(v)
    const { ec, blend } = appliedWater(farm, crop)
    const target = targetECe(crop, ec)
    const lfRaw = maintenanceLF(ec, target)
    const lfCapped = !(lfRaw <= LR_PRACTICAL_MAX)
    const lf = lfCapped ? LR_PRACTICAL_MAX : lfRaw
    const area = valveArea(v)
    // Annual crops: count only in-season days (planting month-day each year); perennials: all days.
    const inSeason = seasonFilter(v)
    let namakMm = 0
    let etcMm = 0
    for (const d of days) {
      if (!inSeason(d.date)) continue
      const { kc } = kcFor(seasonValve(v, d.date), d)
      const e = kc * d.et0
      etcMm += e
      namakMm += e / ((1 - lf) * farm.efficiency)
    }
    // Habit, simulated with the salt model on well water.
    let rz = initialRootZone(farm, v, farm.wellEC)
    const habitMin = v.habitMinutes ?? farm.habitMinutes
    const habitL = litresForMinutes(habitMin, v.emitters, v.emitterLph)
    const habitMm = area > 0 ? habitL / area : 0
    let peak = averageECe(rz)
    let sumECe = 0
    let met = 0
    let dem = 0
    let hn = 0
    for (const d of days) {
      if (!inSeason(d.date)) continue
      const { kc } = kcFor(seasonValve(v, d.date), d)
      const e = kc * d.et0
      const r = stepDay(rz, habitMm * farm.efficiency, farm.wellEC, e)
      rz = r.rz
      const ece = averageECe(rz)
      peak = Math.max(peak, ece)
      sumECe += ece
      met += Math.min(e, habitMm * farm.efficiency)
      dem += e
      hn++
    }
    const habitMean = hn ? sumECe / hn : averageECe(rz)
    // Namak holds the root zone at target unless the leaching fraction had to be capped.
    const namakECe = lfCapped ? targetFromCappedLF(ec, lf) : target
    return {
      valve: v,
      namakLitres: namakMm * area,
      habitLitres: habitL * hn,
      saltLitres: (namakMm - etcMm / farm.efficiency) * area,
      namakYield: yieldPercent(namakECe, crop),
      habitYield: yieldPercent(habitMean, crop),
      habitPeakECe: peak,
      habitMeanECe: habitMean,
      namakECe,
      lf,
      lfCapped,
      blend,
      ecApplied: ec,
      target,
      habitWaterMet: dem > 0 ? met / dem : 1,
    }
  })
  const namakLitres = valves.reduce((a, x) => a + x.namakLitres, 0)
  const habitLitres = valves.reduce((a, x) => a + x.habitLitres, 0)
  const saltLitres = valves.reduce((a, x) => a + x.saltLitres, 0)
  return {
    valves,
    namakLitres,
    habitLitres,
    saltLitres,
    savedLitres: habitLitres - namakLitres,
    savedAed: ((habitLitres - namakLitres) / 1000) * farm.waterCostAedM3,
    days: days.length,
  }
}

function targetFromCappedLF(ec: number, lf: number) {
  return steadyStateECe(lf, ec)
}

function seasonFilter(v: Valve): (date: string) => boolean {
  const crop = CROPS[v.cropId]
  if (crop.perennial || !v.plantingDate || !crop.stages) return () => true
  const { ini, dev, mid, late } = crop.stages
  const len = ini + dev + mid + late
  return (date) => {
    const dap = daysSincePlanting(v.plantingDate!, date)
    return dap >= 0 && dap < len
  }
}

/** Days since the most recent planting anniversary on or before `date`. */
function daysSincePlanting(plantingDate: string, date: string): number {
  const md = plantingDate.slice(5)
  let y = Number(date.slice(0, 4))
  let start = `${y}-${md}`
  if (start > date) start = `${--y}-${md}`
  return Math.round((Date.parse(date) - Date.parse(start)) / 86_400_000)
}

function seasonValve(v: Valve, date: string): Valve {
  if (!v.plantingDate || CROPS[v.cropId].perennial) return v
  const dap = daysSincePlanting(v.plantingDate, date)
  const d = new Date(Date.parse(date) - dap * 86_400_000).toISOString().slice(0, 10)
  return { ...v, plantingDate: d }
}
