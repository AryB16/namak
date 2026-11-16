/**
 * Salt Debt: a daily root-zone salt balance.
 *
 * Source: FAO Irrigation & Drainage Paper 61, Annex 4, "Salt storage equations" (Van Hoorn & Van Alphen 1994).
 * https://www.fao.org/3/Y4263E/y4263e0h.htm
 *
 * Salt is carried as S in "ECmm" (EC × water depth; Annex 4 eq. 16). For each period:
 *   ΔS = (IW·ECiw − R·S_start/Wfc) / (1 + R/(2·Wfc))                          (Annex 4, eq. 21)
 * applied to four root-zone quarters with the standard 40-30-20-10 % water uptake pattern (eq. 22–23),
 * where water percolating out of one quarter (at that quarter's mean soil-water EC) feeds the next.
 * Soil-water EC at field capacity is S/Wfc and ECe ≈ ECsw / 2 (Annex 4 eq. 19: "the soil moisture content of the
 * saturated paste is twice the soil moisture content at field capacity").
 * The root-zone average ECe is the mean of five depths — the infiltrating water and the bottom of each quarter —
 * as in Annex 4 Figure A4.2 / FAO-29. At steady state this reproduces the FAO concentration factors in Annex 4
 * Table A4.1 (e.g. LF 0.15 → 1.6 × ECiw, LF 0.10 → 2.1 × ECiw); see salt.test.ts.
 *
 * SIMPLIFICATIONS (documented in the README):
 *  - complete mixing within each quarter (leaching efficiency f = 1), no capillary rise, adequate drainage;
 *  - salts from rain, fertiliser and crop removal ignored; no precipitation/dissolution chemistry;
 *  - the soil returns to field capacity after each daily drip irrigation; if a day's water is less than the crop
 *    uses, the crop is assumed to use only what was applied (no percolation that day);
 *  - one daily time step.
 */

export const UPTAKE_PATTERN = [0.4, 0.3, 0.2, 0.1] as const

export interface RootZone {
  /** Salt stored in each quarter, ECmm. */
  s: [number, number, number, number]
  /** Water held at field capacity in each quarter, mm. */
  wfc: number
  /** EC of the last infiltrated water (used for the surface term of the average). */
  lastEcIw: number
}

/** Water held at field capacity in one root-zone quarter (mm) for root depth Zr (m) and θFC (m³/m³). */
export function quarterWfc(rootDepthM: number, thetaFc: number): number {
  return (rootDepthM * 1000 * thetaFc) / 4
}

/**
 * Build a root zone whose five-depth average ECe equals `ece`, with uniform salinity in the four quarters.
 * Used to start the model from a soil test (or an assumed starting value).
 */
export function rootZoneFromECe(ece: number, ecIw: number, wfc: number): RootZone {
  // average ECe = (ECiw + 4·ECsw) / 5 / 2  →  ECsw = (10·ECe − ECiw) / 4
  const ecsw = Math.max(0, (10 * ece - ecIw) / 4)
  const s = ecsw * wfc
  return { s: [s, s, s, s], wfc, lastEcIw: ecIw }
}

/** Root-zone average ECe (dS/m), five-depth mean. */
export function averageECe(rz: RootZone): number {
  const ecsw = rz.s.map((x) => x / rz.wfc)
  return (rz.lastEcIw + ecsw[0] + ecsw[1] + ecsw[2] + ecsw[3]) / 5 / 2
}

export interface DayResult {
  rz: RootZone
  /** Water percolating below the root zone, mm. */
  drainage: number
  /** Crop water use actually met, mm. */
  etActual: number
  /** Salt that left the root zone, ECmm. */
  saltOut: number
  /** Salt that came in, ECmm. */
  saltIn: number
}

/**
 * Advance the root zone by one day.
 * @param iw   infiltrated water, mm (applied × efficiency)
 * @param ecIw EC of the infiltrated water, dS/m
 * @param etc  crop water demand, mm
 */
export function stepDay(rz: RootZone, iw: number, ecIw: number, etc: number): DayResult {
  const et = Math.min(etc, Math.max(0, iw))
  const s = [...rz.s] as RootZone['s']
  const w = rz.wfc
  let inflow = Math.max(0, iw)
  let inflowEc = ecIw
  const saltIn = inflow * ecIw
  let saltOut = 0
  for (let k = 0; k < 4; k++) {
    const uptake = UPTAKE_PATTERN[k] * et
    const r = Math.max(0, inflow - uptake)
    const sStart = s[k]
    // FAO-61 Annex 4 eq. 21–23
    const dS = (inflow * inflowEc - (r * sStart) / w) / (1 + r / (2 * w))
    const sEnd = Math.max(0, sStart + dS)
    s[k] = sEnd
    // water leaving this quarter carries the quarter's mean soil-water EC over the period (eq. 20)
    const meanEc = (sStart + sEnd) / (2 * w)
    inflow = r
    inflowEc = meanEc
    if (k === 3) saltOut = r * meanEc
  }
  return {
    rz: { s, wfc: w, lastEcIw: iw > 0 ? ecIw : rz.lastEcIw },
    drainage: inflow,
    etActual: et,
    saltOut,
    saltIn,
  }
}

/** Total salt stored in the root zone, ECmm (≈ g/m² × 0.64; Annex 4 notes 1 dS/m ≈ 640 mg/L). */
export function totalSalt(rz: RootZone): number {
  return rz.s[0] + rz.s[1] + rz.s[2] + rz.s[3]
}

/**
 * Smallest extra infiltrated depth (mm) that, added to `baseIw` today, brings the average ECe down to `targetEce`.
 * Bisection on stepDay. Returns Infinity if even `maxExtra` mm is not enough.
 */
export function repaymentDepth(
  rz: RootZone,
  baseIw: number,
  ecIw: number,
  etc: number,
  targetEce: number,
  maxExtra = 200,
): number {
  const ece = (extra: number) => averageECe(stepDay(rz, baseIw + extra, ecIw, etc).rz)
  if (ece(0) <= targetEce) return 0
  if (ece(maxExtra) > targetEce) return Infinity
  let lo = 0
  let hi = maxExtra
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (ece(mid) > targetEce) lo = mid
    else hi = mid
  }
  return hi
}

/**
 * Steady-state root-zone average ECe for a leaching fraction, using the same four-layer, 40-30-20-10 % uptake
 * concept as FAO-29 (FAO 1985b) and FAO-61 Annex 4 Figure A4.2 / Table A4.1:
 *   LF_k = 1 − (1 − LF)·(cumulative uptake to the bottom of quarter k),  ECsw_k = ECiw / LF_k,
 *   ECe = (ECiw + ΣECsw_k) / 5 / 2.
 */
export function steadyStateECe(lf: number, ecIw: number): number {
  let cum = 0
  let sum = ecIw
  for (const u of UPTAKE_PATTERN) {
    cum += u
    sum += ecIw / (1 - (1 - lf) * cum)
  }
  return sum / 10
}

/**
 * Leaching fraction that holds the root-zone average ECe at `targetEce` at steady state (inverse of
 * steadyStateECe, by bisection). This is the FAO-29 concentration-factor method; FAO-29 eq. 9 is its quick
 * empirical estimate. Returns Infinity if even LF 0.95 cannot reach the target.
 */
export function leachingFractionForTarget(ecIw: number, targetEce: number): number {
  if (ecIw <= 0) return 0
  if (steadyStateECe(0.95, ecIw) > targetEce) return Infinity
  let lo = 0.001
  let hi = 0.95
  if (steadyStateECe(lo, ecIw) <= targetEce) return lo
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (steadyStateECe(mid, ecIw) > targetEce) lo = mid
    else hi = mid
  }
  return hi
}

/** Largest water EC whose required leaching fraction stays at or below `lfMax` (steady-state, four-layer). */
export function maxECwForLF(targetEce: number, lfMax: number): number {
  return targetEce / steadyStateECe(lfMax, 1)
}
