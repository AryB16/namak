/**
 * Water arithmetic. Units: depths in mm over the crop area (1 mm on 1 m² = 1 L), EC in dS/m.
 */
import { LR_PRACTICAL_MAX, type Crop } from './crops'

/** FAO-56 eq. 56: ETc = Kc × ET0 (mm/day). */
export function etc(kc: number, et0: number): number {
  return kc * et0
}

/**
 * FAO-29 equation (9) (Rhoades 1974; Rhoades & Merrill 1976):
 *   LR = ECw / (5·ECe − ECw)
 * Returns Infinity when the water is too salty to ever hold the soil at the target (5·ECe ≤ ECw).
 */
export function leachingRequirement(ecw: number, eceTarget: number): number {
  if (ecw <= 0) return 0
  const denom = 5 * eceTarget - ecw
  if (denom <= 0) return Infinity
  return ecw / denom
}

/**
 * Gross water to apply: FAO-29 equation (7) AW = ET / (1 − LR), divided by the application efficiency.
 * Gross = ETc / ((1 − LR) × efficiency).
 */
export function grossDepth(etcMm: number, lr: number, efficiency: number): number {
  const lf = Math.min(lr, 0.95)
  return etcMm / ((1 - lf) * efficiency)
}

/** Litres for a depth (mm) over an area (m²). */
export function depthToLitres(depthMm: number, areaM2: number): number {
  return depthMm * areaM2
}

/** Valve run time in minutes: litres / (emitters × L/h) × 60. */
export function valveMinutes(litres: number, emitters: number, emitterLph: number): number {
  const flow = emitters * emitterLph
  if (flow <= 0) return 0
  return (litres / flow) * 60
}

/** Litres delivered by a valve running for a number of minutes. */
export function litresForMinutes(minutes: number, emitters: number, emitterLph: number): number {
  return (minutes / 60) * emitters * emitterLph
}

/**
 * Relative yield from soil salinity, Maas & Hoffman form used by FAO-29 (Table 4, footnote 1) and FAO-56 (Table 23):
 *   Y = 100 − b (ECe − threshold) above the threshold, clamped to 0–100 %.
 */
export function yieldPercent(ece: number, crop: Crop): number {
  if (ece <= crop.ecThreshold) return 100
  return Math.max(0, Math.min(100, 100 - crop.slopeB * (ece - crop.ecThreshold)))
}

/**
 * Largest irrigation-water EC that keeps the leaching requirement at the practical limit (FAO-29: LR above
 * 0.25–0.30 "may not be practical"). Solving LR = ECw/(5·ECe − ECw) for ECw:
 *   ECw_max = 5·ECe·LRmax / (1 + LRmax)
 */
export function maxPracticalECw(eceTarget: number, lrMax = LR_PRACTICAL_MAX): number {
  return (5 * eceTarget * lrMax) / (1 + lrMax)
}

export interface BlendAdvice {
  needed: boolean
  /** Fraction of the cleaner water in the mix, 0–1. */
  cleanFraction: number
  /** EC of the blended water, dS/m. */
  blendEC: number
  /** Leaching requirement with the blend. */
  lrWithBlend: number
  /** Leaching requirement with well water alone (may be Infinity). */
  lrWellOnly: number
}

/**
 * Blend advice. Mixing is linear in EC (salt mass balance; FAO-29 treats EC as a salt-concentration proxy).
 * Clean fraction x solves (1 − x)·ECwell + x·ECclean = ECw_max.
 */
export function blendAdvice(ecWell: number, ecClean: number, eceTarget: number, lrMax = LR_PRACTICAL_MAX): BlendAdvice {
  const lrWellOnly = leachingRequirement(ecWell, eceTarget)
  const ecMax = maxPracticalECw(eceTarget, lrMax)
  if (lrWellOnly <= lrMax || ecWell <= ecMax) {
    return { needed: false, cleanFraction: 0, blendEC: ecWell, lrWithBlend: lrWellOnly, lrWellOnly }
  }
  const x = ecWell - ecClean <= 0 ? 1 : Math.min(1, (ecWell - ecMax) / (ecWell - ecClean))
  const blendEC = (1 - x) * ecWell + x * ecClean
  return { needed: true, cleanFraction: x, blendEC, lrWithBlend: leachingRequirement(blendEC, eceTarget), lrWellOnly }
}
