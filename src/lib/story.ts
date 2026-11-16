/**
 * Story numbers for the first-visit page. Pure: computed from the bundled ERA5 year for the illustrative demo farm.
 * Runs in a Web Worker (story.worker.ts) so the first screen stays responsive.
 */
import { DEMO_FARM } from '../data/demoFarm'
import era5 from '../data/snapshot-era5.json'
import { compareYear } from '../engine/farm'
import { replaySeason, type WeatherDay } from '../engine/plan'

export type Story = ReturnType<typeof computeStory>

export function computeStory() {
  const days = era5.days as WeatherDay[]
  const year = compareYear(DEMO_FARM, days)
  // Only the palm valve needs a day-by-day replay (for the pinned chart); the rest comes from compareYear.
  const pv = DEMO_FARM.valves.find((v) => v.cropId === 'date-palm')!
  const r = replaySeason(DEMO_FARM, pv, days)
  const palms = { v: pv, r }
  const over = (d: { eceEnd: number; target: number }[]) => d.filter((x) => x.eceEnd > x.target + 0.05).length
  const yTomato = year.valves.find((v) => v.valve.cropId === 'tomato')!
  return {
    saltM3: year.saltLitres / 1000,
    cropM3: (year.namakLitres - year.saltLitres) / 1000,
    // Same figures as the "Habit vs Namak" screen and the README (12 months of ERA5 weather).
    savedPct: (year.savedLitres / year.habitLitres) * 100,
    palms,
    palmHabitOver: over(r.habit),
    palmNamakOver: over(r.namak),
    palmPeakPct: (Math.max(...r.habit.map((d) => d.eceEnd)) / r.habit[0].target - 1) * 100,
    tomatoHabit: yTomato.habitYield,
    tomatoNamak: yTomato.namakYield,
    from: days.slice(-365)[0].date,
    to: days[days.length - 1].date,
  }
}
