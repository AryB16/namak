/**
 * Crop constants for Namak. Every number cites its primary source.
 *
 * Sources (all fetched and read on 16 Nov 2026):
 *  [FAO-29]  Ayers & Westcot, "Water quality for agriculture", FAO Irrigation & Drainage Paper 29 Rev.1,
 *            Table 4 "Crop tolerance and yield potential ... (ECw) or soil salinity (ECe)".
 *            https://www.fao.org/3/t0234e/T0234E03.htm
 *  [FAO-56/T11] Allen et al., FAO Irrigation & Drainage Paper 56, Table 11 "Lengths of crop development stages".
 *  [FAO-56/T12] FAO-56 Table 12 "Single (time-averaged) crop coefficients, Kc, and mean maximum plant heights".
 *            https://www.fao.org/3/X0490E/x0490e0b.htm
 *  [FAO-56/T22] FAO-56 Table 22 "Ranges of maximum effective rooting depth (Zr)".
 *  [FAO-56/T23] FAO-56 Table 23 "Salt tolerance of common agricultural crops" (threshold ECe and slope b).
 *            https://www.fao.org/3/X0490E/x0490e0e.htm
 *
 * Choices we made on top of the tables are marked ASSUMPTION; anything without a primary source is UNVERIFIED.
 */

export type CropId = 'date-palm' | 'tomato' | 'cucumber' | 'lettuce' | 'bermuda'

export interface CropStages {
  /** Days in each FAO-56 growth stage: initial, development, mid-season, late season. */
  ini: number
  dev: number
  mid: number
  late: number
  /** Where the stage lengths come from. */
  source: string
}

export interface Crop {
  id: CropId
  name: string
  /** Short label used on valve cards. */
  short: string
  /** FAO-56 Table 12 single crop coefficients. */
  kcIni: number
  kcMid: number
  kcEnd: number
  /** Perennial crops are modelled at a constant Kc mid (mature, full cover). */
  perennial: boolean
  /** FAO-56 Table 11 stage lengths (annual crops only). */
  stages?: CropStages
  /** Mean maximum plant height, m (FAO-56 Table 12) — used in the climate adjustment of Kc (FAO-56 eq. 62). */
  heightM: number
  /** Effective rooting depth used in the salt model, m (from the FAO-56 Table 22 range). */
  rootDepthM: number
  /** Soil salinity (ECe, dS/m) at which yield starts to fall: 100 % yield potential (FAO-29 Table 4). */
  ecThreshold: number
  /** ECe (dS/m) at 90 % yield potential (FAO-29 Table 4). */
  ec90: number
  /** ECe (dS/m) at which growth ceases, 0 % yield (FAO-29 Table 4). */
  ecZero: number
  /** Yield decline per dS/m above the threshold, % (FAO-56 Table 23). */
  slopeB: number
  /** FAO-29 Table 5 / FAO-56 Table 23 tolerance rating. */
  rating: 'S' | 'MS' | 'MT' | 'T'
  sources: string[]
}

export const CROPS: Record<CropId, Crop> = {
  'date-palm': {
    id: 'date-palm',
    name: 'Date palm',
    short: 'Palms',
    // FAO-56 Table 12, "Date Palms": Kc ini 0.90, Kc mid 0.95, Kc end 0.95, h = 8 m.
    kcIni: 0.9,
    kcMid: 0.95,
    kcEnd: 0.95,
    perennial: true,
    heightM: 8,
    // FAO-56 Table 22, "Date Palms": Zr 1.5–2.5 m. ASSUMPTION: we use the low end (1.5 m) because drip
    // irrigation concentrates active roots in the wetted bulb.
    rootDepthM: 1.5,
    // FAO-29 Table 4, "Date palm": ECe 4.0 (100 %), 6.8 (90 %), 32 (0 %).
    ecThreshold: 4.0,
    ec90: 6.8,
    ecZero: 32,
    // FAO-56 Table 23, "Date Palms": threshold 4.0, b = 3.6 %/(dS/m), rating T.
    slopeB: 3.6,
    rating: 'T',
    sources: ['FAO-56 Table 12', 'FAO-56 Table 22', 'FAO-29 Table 4', 'FAO-56 Table 23'],
  },
  tomato: {
    id: 'tomato',
    name: 'Tomato',
    short: 'Tomato',
    // FAO-56 Table 12: Solanum family Kc ini 0.6; Tomato Kc mid 1.15; Kc end 0.70–0.90.
    // ASSUMPTION: Kc end = 0.80, the midpoint of the published range.
    kcIni: 0.6,
    kcMid: 1.15,
    kcEnd: 0.8,
    perennial: false,
    // FAO-56 Table 11, Tomato, Oct/Nov planting, "Arid Region": 35 / 45 / 70 / 30 days (180 total).
    stages: { ini: 35, dev: 45, mid: 70, late: 30, source: 'FAO-56 Table 11, Tomato, Oct/Nov, Arid Region' },
    heightM: 0.6, // FAO-56 Table 12
    // FAO-56 Table 22, Tomato: Zr 0.7–1.5 m. ASSUMPTION: low end for drip.
    rootDepthM: 0.7,
    // FAO-29 Table 4, "Tomato": ECe 2.5 (100 %), 3.5 (90 %), 13 (0 %).
    ecThreshold: 2.5,
    ec90: 3.5,
    ecZero: 13,
    // FAO-56 Table 23, Tomato: threshold 0.9–2.5, b = 9.0, rating MS.
    slopeB: 9.0,
    rating: 'MS',
    sources: ['FAO-56 Table 11', 'FAO-56 Table 12', 'FAO-56 Table 22', 'FAO-29 Table 4', 'FAO-56 Table 23'],
  },
  cucumber: {
    id: 'cucumber',
    name: 'Cucumber',
    short: 'Cucumber',
    // FAO-56 Table 12, "Cucumber – Fresh Market": Kc ini 0.6, Kc mid 1.00, Kc end 0.75, h = 0.3 m.
    kcIni: 0.6,
    kcMid: 1.0,
    kcEnd: 0.75,
    perennial: false,
    // FAO-56 Table 11, Cucumber, Nov/Feb planting, "Arid Region": 25 / 35 / 50 / 20 days (130 total).
    stages: { ini: 25, dev: 35, mid: 50, late: 20, source: 'FAO-56 Table 11, Cucumber, Nov/Feb, Arid Region' },
    heightM: 0.3,
    // FAO-56 Table 22, Cucumber (fresh market): Zr 0.7–1.2 m. ASSUMPTION: low end for drip.
    rootDepthM: 0.7,
    // FAO-29 Table 4, "Cucumber": ECe 2.5 (100 %), 3.3 (90 %), 10 (0 %).
    ecThreshold: 2.5,
    ec90: 3.3,
    ecZero: 10,
    // FAO-56 Table 23, Cucumber: threshold 1.1–2.5, b = 7.0–13.0. ASSUMPTION: b = 13.0, the end of the range
    // consistent with FAO-29 Table 4 (100 / (10 − 2.5) = 13.3).
    slopeB: 13.0,
    rating: 'MS',
    sources: ['FAO-56 Table 11', 'FAO-56 Table 12', 'FAO-56 Table 22', 'FAO-29 Table 4', 'FAO-56 Table 23'],
  },
  lettuce: {
    id: 'lettuce',
    name: 'Lettuce',
    short: 'Lettuce',
    // FAO-56 Table 12: small vegetables Kc ini 0.7; Lettuce Kc mid 1.00, Kc end 0.95, h = 0.3 m.
    kcIni: 0.7,
    kcMid: 1.0,
    kcEnd: 0.95,
    perennial: false,
    // FAO-56 Table 11, Lettuce, Oct/Nov planting, "Arid Region": 25 / 35 / 30 / 10 days (100 total).
    stages: { ini: 25, dev: 35, mid: 30, late: 10, source: 'FAO-56 Table 11, Lettuce, Oct/Nov, Arid Region' },
    heightM: 0.3,
    // FAO-56 Table 22, Lettuce: Zr 0.3–0.5 m. ASSUMPTION: low end for drip.
    rootDepthM: 0.3,
    // FAO-29 Table 4, "Lettuce": ECe 1.3 (100 %), 2.1 (90 %), 9.0 (0 %).
    ecThreshold: 1.3,
    ec90: 2.1,
    ecZero: 9.0,
    // FAO-56 Table 23, Lettuce: threshold 1.3–1.7, b = 12.0, rating MS.
    slopeB: 12.0,
    rating: 'MS',
    sources: ['FAO-56 Table 11', 'FAO-56 Table 12', 'FAO-56 Table 22', 'FAO-29 Table 4', 'FAO-56 Table 23'],
  },
  bermuda: {
    id: 'bermuda',
    // Rhodes grass, the common UAE fodder, is not in FAO-29 Table 4 or FAO-56 Table 23. Bermuda grass is the
    // closest perennial warm-season fodder grass that is listed, so we use it as the fodder crop.
    name: 'Fodder grass (Bermuda)',
    short: 'Fodder',
    // FAO-56 Table 12, "Bermuda hay – averaged cutting effects": Kc ini 0.55, Kc mid 1.00, Kc end 0.85, h 0.35 m.
    kcIni: 0.55,
    kcMid: 1.0,
    kcEnd: 0.85,
    perennial: true,
    heightM: 0.35,
    // FAO-56 Table 22, "Bermuda – for hay": Zr 1.0–1.5 m. ASSUMPTION: low end for drip.
    rootDepthM: 1.0,
    // FAO-29 Table 4, "Bermuda grass": ECe 6.9 (100 %), 8.5 (90 %), 23 (0 %).
    ecThreshold: 6.9,
    ec90: 8.5,
    ecZero: 23,
    // FAO-56 Table 23, Bermuda: threshold 6.9, b = 6.4, rating T.
    slopeB: 6.4,
    rating: 'T',
    sources: ['FAO-56 Table 12', 'FAO-56 Table 22', 'FAO-29 Table 4', 'FAO-56 Table 23'],
  },
}

export const CROP_LIST: Crop[] = Object.values(CROPS)

/**
 * Field capacity of the soil, m³/m³. FAO-56 Table 19 ("Typical soil water characteristics"), Sand: θFC 0.07–0.17.
 * ASSUMPTION: 0.12, the midpoint for sand. https://www.fao.org/3/X0490E/x0490e0c.htm
 */
export const SAND_THETA_FC = 0.12

/**
 * Drip application efficiency (fraction of applied water that reaches the root zone).
 * UNVERIFIED: 0.90 is a widely used design value for drip; we did not find it in a primary FAO table during
 * the build. It is editable in Farm setup.
 */
export const DEFAULT_DRIP_EFFICIENCY = 0.9

/**
 * FAO-29 (section 2.4.3): "increasing the leaching to satisfy a leaching requirement greater than 0.25–0.30
 * may not be practical because of the excessive amount of water required". Above this we suggest blending.
 */
export const LR_PRACTICAL_MAX = 0.25

/**
 * FAO-29 (leaching requirement section): use the 90 % yield ECe in equation (9), but "for water in the moderate
 * to high salinity range (>1.5 dS/m), it might be better to use the ECe value for maximum yield potential (100 %)".
 */
export const HIGH_SALINITY_WATER_ECW = 1.5

/** Target root-zone ECe for the leaching requirement, following the FAO-29 rule above. */
export function targetECe(crop: Crop, ecw: number): number {
  return ecw > HIGH_SALINITY_WATER_ECW ? crop.ecThreshold : crop.ec90
}

/** FAO-56 growth stage name for a day in the season. */
export type Stage = 'initial' | 'development' | 'mid-season' | 'late season' | 'mature'

/**
 * Crop coefficient for a given day after planting, using the FAO-56 piecewise-linear Kc curve
 * (FAO-56 chapter 6, "Construction of the Kc curve"): flat Kc ini, linear rise to Kc mid, flat Kc mid,
 * linear fall to Kc end. Perennials return Kc mid (mature canopy).
 */
export function kcForDay(crop: Crop, dayAfterPlanting: number): { kc: number; stage: Stage } {
  if (crop.perennial || !crop.stages) return { kc: crop.kcMid, stage: 'mature' }
  const { ini, dev, mid, late } = crop.stages
  const d = Math.max(0, dayAfterPlanting)
  if (d < ini) return { kc: crop.kcIni, stage: 'initial' }
  if (d < ini + dev) {
    const f = (d - ini) / dev
    return { kc: crop.kcIni + f * (crop.kcMid - crop.kcIni), stage: 'development' }
  }
  if (d < ini + dev + mid) return { kc: crop.kcMid, stage: 'mid-season' }
  const f = Math.min(1, (d - ini - dev - mid) / late)
  return { kc: crop.kcMid + f * (crop.kcEnd - crop.kcMid), stage: 'late season' }
}

export function seasonLength(crop: Crop): number {
  if (!crop.stages) return 365
  const { ini, dev, mid, late } = crop.stages
  return ini + dev + mid + late
}

/**
 * FAO-56 equation 62: climate adjustment of Kc mid (and, by eq. 65, of Kc end when Kc end ≥ 0.45) for climates
 * other than RHmin ≈ 45 %, u2 ≈ 2 m/s:
 *   Kc = Kc(Tab) + [0.04 (u2 − 2) − 0.004 (RHmin − 45)] (h / 3)^0.3
 * with u2 limited to 1–6 m/s, RHmin to 20–80 %, h to 0.1–10 m (FAO-56 limits).
 * Applied only in mid-season, late season and for mature perennials.
 */
export function climateAdjustedKc(kc: number, stage: Stage, crop: Crop, u2: number, rhMin: number): number {
  if (stage === 'initial' || stage === 'development') return kc
  if (stage === 'late season' && crop.kcEnd < 0.45) return kc
  const u = Math.min(6, Math.max(1, u2))
  const rh = Math.min(80, Math.max(20, rhMin))
  const h = Math.min(10, Math.max(0.1, crop.heightM))
  return kc + (0.04 * (u - 2) - 0.004 * (rh - 45)) * Math.pow(h / 3, 0.3)
}

/**
 * FAO-56 equation 47: wind speed at 2 m from a measurement at height z (m): u2 = uz · 4.87 / ln(67.8 z − 5.42).
 * Open-Meteo reports wind at 10 m.
 */
export function windAt2m(uz: number, z = 10): number {
  return (uz * 4.87) / Math.log(67.8 * z - 5.42)
}
