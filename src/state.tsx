import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEMO_FARM } from './data/demoFarm'
import { getForecast, getLastYear, type WeatherResult } from './data/weather'
import type { Farm, WeatherDay } from './engine/plan'

const FARM_KEY = 'namak.farm.v1'

function loadFarm(): Farm {
  try {
    const raw = localStorage.getItem(FARM_KEY)
    if (raw) {
      const f = JSON.parse(raw) as Farm
      if (f && Array.isArray(f.valves)) return f
    }
  } catch {
    /* ignore */
  }
  return DEMO_FARM
}

export interface ECReading {
  at: string
  ec: number
  previous: number
  source: 'photo' | 'manual'
}

interface AppState {
  farm: Farm
  setFarm: (f: Farm) => void
  resetFarm: () => void
  isDemo: boolean
  forecast: WeatherResult | null
  forecastError: string | null
  /** Plan days from tomorrow onward (up to 7). */
  planDays: WeatherDay[]
  year: WeatherResult | null
  yearError: string | null
  online: boolean
  readings: ECReading[]
  addReading: (r: ECReading) => void
  refresh: () => void
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

/** Forecast index 0 is "today" at fetch time; shift for cached copies so "tomorrow" stays tomorrow. */
function planDaysFrom(fc: WeatherResult | null): WeatherDay[] {
  if (!fc) return []
  const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(fc.fetchedAt)) / 86_400_000))
  const start = Math.min(1 + ageDays, Math.max(0, fc.days.length - 1))
  return fc.days.slice(start, start + 7)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [farm, setFarmState] = useState<Farm>(loadFarm)
  const [forecast, setForecast] = useState<WeatherResult | null>(null)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [year, setYear] = useState<WeatherResult | null>(null)
  const [yearError, setYearError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [readings, setReadings] = useState<ECReading[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('namak.readings.v1') || '[]')
    } catch {
      return []
    }
  })
  const [tick, setTick] = useState(0)

  const setFarm = useCallback((f: Farm) => {
    setFarmState(f)
    try {
      localStorage.setItem(FARM_KEY, JSON.stringify(f))
    } catch {
      /* ignore */
    }
  }, [])

  const resetFarm = useCallback(() => {
    try {
      localStorage.removeItem(FARM_KEY)
      localStorage.removeItem('namak.readings.v1')
    } catch {
      /* ignore */
    }
    setFarmState(DEMO_FARM)
    setReadings([])
  }, [])

  const addReading = useCallback((r: ECReading) => {
    setReadings((prev) => {
      const next = [r, ...prev].slice(0, 30)
      try {
        localStorage.setItem('namak.readings.v1', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    let alive = true
    setForecastError(null)
    getForecast(farm.lat, farm.lon)
      .then((r) => alive && setForecast(r))
      .catch(() => alive && setForecastError('No forecast yet — connect once to load the plan.'))
    getLastYear(farm.lat, farm.lon)
      .then((r) => alive && setYear(r))
      .catch(() => alive && setYearError('Historical weather is not available offline for this location yet.'))
    return () => {
      alive = false
    }
  }, [farm.lat, farm.lon, tick, online])

  const value = useMemo<AppState>(
    () => ({
      farm,
      setFarm,
      resetFarm,
      isDemo: farm === DEMO_FARM,
      forecast,
      forecastError,
      planDays: planDaysFrom(forecast),
      year,
      yearError,
      online,
      readings,
      addReading,
      refresh: () => setTick((t) => t + 1),
    }),
    [farm, setFarm, resetFarm, forecast, forecastError, year, yearError, online, readings, addReading],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
