import { DEFAULT_DRIP_EFFICIENCY, SAND_THETA_FC } from '../engine/crops'
import type { Farm } from '../engine/plan'

/**
 * ILLUSTRATIVE demo farm. Location, layout, well EC, soil tests, habit and prices are realistic for a small mixed
 * farm near Al Ain but are not measurements from a real farm. Weather is real (Open-Meteo).
 */
export const DEMO_FARM: Farm = {
  name: 'Demo farm',
  place: 'near Al Ain, UAE',
  lat: 24.21,
  lon: 55.74,
  // Illustrative brackish well (FAO-29 Table 1: ECw > 3.0 dS/m = "severe" restriction on use).
  wellEC: 3.2,
  // Illustrative small reverse-osmosis unit used for blending.
  cleanEC: 0.3,
  canBlend: true,
  // Illustrative all-in cost of water at the valve (pumping energy + RO share), AED per m³.
  waterCostAedM3: 1.5,
  efficiency: DEFAULT_DRIP_EFFICIENCY,
  thetaFc: SAND_THETA_FC,
  habitMinutes: 120,
  maxValveMinutes: 360,
  valves: [
    {
      id: 'v1',
      name: 'Valve 1',
      cropId: 'date-palm',
      plants: 30,
      spacingM2: 64, // 8 m × 8 m
      emitters: 120, // 4 bubblers per palm
      emitterLph: 60,
      soilECe: 4.15, // illustrative soil test, Oct 2026
      habitMinutes: 220, // the worker's summer setting, left on all year
    },
    {
      id: 'v2',
      name: 'Valve 2',
      cropId: 'bermuda',
      plants: 1000,
      spacingM2: 1, // 1 000 m² fodder plot
      emitters: 2500,
      emitterLph: 2,
      soilECe: 6.0,
      habitMinutes: 140,
    },
    {
      id: 'v3',
      name: 'Valve 3',
      cropId: 'tomato',
      plants: 1200,
      spacingM2: 0.5,
      emitters: 1200,
      emitterLph: 2,
      plantingDate: '2026-10-01',
      soilECe: 2.65,
      habitMinutes: 110,
    },
  ],
}
