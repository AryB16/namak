import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEMO_FARM } from './data/demoFarm'
import { getForecast, getLastYear, peekForecast, peekLastYear, type WeatherResult } from './data/weather'
import demoAssets from './data/demoAssets.json'
import snapshotForecast from './data/snapshot-forecast.json'
import snapshotEra5 from './data/snapshot-era5.json'
import type { Farm, WeatherDay } from './engine/plan'

const FARM_KEY = 'namak.farm.v1'

/** The recorded forecast days the demo's saved AI messages were made for (tomorrow onward). */
const DEMO_DAYS: WeatherDay[] = (snapshotForecast.days as WeatherDay[]).filter((d) => d.date >= demoAssets.demoDay).slice(0, 7)

/**
 * Recorded real data (default): the Open-Meteo forecast recorded on 16 Nov 2026 and the ERA5 weather year that ends on
 * 10 Nov 2026. Every number on the site stays the same from day to day (judging, the video), and matches the saved
 * Gemini messages. "Use live forecast" switches to live data.
 */
const RECORDED_FORECAST: WeatherResult = {
  days: snapshotForecast.days as WeatherDay[],
  source: 'snapshot',
  fetchedAt: snapshotForecast.fetchedAt,
  label: 'Recorded forecast · Open-Meteo',
}
const RECORDED_YEAR: WeatherResult = {
  days: snapshotEra5.days as WeatherDay[],
  source: 'snapshot',
  fetchedAt: snapshotEra5.fetchedAt,
  label: 'Historical weather · ERA5 via Open-Meteo',
}
const LIVE_KEY = 'namak.live.v1'
const near = (a: number, b: number) => Math.abs(a - b) < 0.05

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
  /** True while the live forecast is being fetched (a cached one may already be on screen). */
  forecastLoading: boolean
  /** True when the plan uses the recorded demo-day forecast (default, and always during the guided demo). */
  demoDay: boolean
  /** True when the user switched to live forecast + live weather history. */
  liveData: boolean
  setLiveData: (on: boolean) => void
  setDemoDay: (on: boolean) => void
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
  // Instant first paint: start from the last saved forecast (if recent) while the live one loads.
  const [forecast, setForecast] = useState<WeatherResult | null>(() => peekForecast(loadFarm().lat, loadFarm().lon))
  const [forecastLoading, setForecastLoading] = useState(true)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [year, setYear] = useState<WeatherResult | null>(() => peekLastYear(loadFarm().lat, loadFarm().lon))
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
  const [demoDay, setDemoDay] = useState(false)
  const [liveData, setLiveDataState] = useState(() => {
    try {
      return localStorage.getItem(LIVE_KEY) === '1'
    } catch {
      return false
    }
  })
  const setLiveData = useCallback((on: boolean) => {
    setLiveDataState(on)
    try {
      localStorage.setItem(LIVE_KEY, on ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])
  // Recorded data exists for the demo farm's location only; anywhere else always uses live data.
  const recorded = !liveData && near(farm.lat, snapshotForecast.lat) && near(farm.lon, snapshotForecast.lon)

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
    // Recorded mode needs no network at all.
    if (recorded) {
      setForecastLoading(false)
      return
    }
    let alive = true
    setForecastError(null)
    setForecastLoading(true)
    getForecast(farm.lat, farm.lon)
      .then((r) => alive && setForecast(r))
      .catch(() => alive && setForecastError('No forecast yet — connect once to load the plan.'))
      .finally(() => alive && setForecastLoading(false))
    // The year of history is only needed on the comparison screens: load it after the first screen is up.
    const loadYear = () =>
      getLastYear(farm.lat, farm.lon)
        .then((r) => alive && setYear(r))
        .catch(() => alive && setYearError('Historical weather is not available offline for this location yet.'))
    const idle = 'requestIdleCallback' in window
    const t = idle ? window.requestIdleCallback(loadYear, { timeout: 2500 }) : window.setTimeout(loadYear, 1200)
    return () => {
      alive = false
      if (idle) window.cancelIdleCallback(t)
      else clearTimeout(t)
    }
  }, [farm.lat, farm.lon, tick, online, recorded])

  const value = useMemo<AppState>(
    () => ({
      farm,
      setFarm,
      resetFarm,
      isDemo: farm === DEMO_FARM,
      forecast: recorded ? RECORDED_FORECAST : forecast,
      forecastError: recorded ? null : forecastError,
      forecastLoading: recorded ? false : forecastLoading,
      planDays: demoDay || recorded ? DEMO_DAYS : planDaysFrom(forecast),
      demoDay: demoDay || recorded,
      setDemoDay,
      liveData: !recorded,
      setLiveData,
      year: recorded ? RECORDED_YEAR : year,
      yearError: recorded ? null : yearError,
      online,
      readings,
      addReading,
      refresh: () => setTick((t) => t + 1),
    }),
    [farm, setFarm, resetFarm, forecast, forecastError, forecastLoading, demoDay, recorded, setLiveData, year, yearError, online, readings, addReading],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
