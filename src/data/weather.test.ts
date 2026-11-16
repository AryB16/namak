import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveUrl, forecastUrl, getForecast, parseDaily } from './weather'

const daily = {
  time: ['2026-11-17', '2026-11-18'],
  et0_fao_evapotranspiration: [4.25, null],
  temperature_2m_max: [29.4, 30.5],
  relative_humidity_2m_min: [36, 33],
  wind_speed_10m_mean: [2.15, 2.36],
  sunrise: ['2026-11-17T06:33', '2026-11-18T06:34'],
}

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
}

describe('Open-Meteo parsing', () => {
  it('converts wind to 2 m, keeps sunrise time, drops days without ET0', () => {
    const d = parseDaily(daily)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ date: '2026-11-17', et0: 4.25, tmax: 29.4, rhMin: 36, sunrise: '06:33' })
    expect(d[0].u2).toBeCloseTo(2.15 * 0.748, 2)
  })
  it('URLs ask for the documented variables, ERA5 only for the archive', () => {
    expect(forecastUrl(24.21, 55.74)).toContain('daily=et0_fao_evapotranspiration,temperature_2m_max')
    expect(archiveUrl(24.21, 55.74, '2025-11-01', '2026-11-10')).toContain('models=era5')
  })
})

describe('fallback chain', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemStorage())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('live → caches the response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ daily }) })))
    const r = await getForecast(24.21, 55.74)
    expect(r.source).toBe('live')
    expect(r.days[0].et0).toBe(4.25)
  })

  it('network down → last cached plan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ daily }) })))
    await getForecast(24.21, 55.74)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    const r = await getForecast(24.21, 55.74)
    expect(r.source).toBe('cache')
    expect(r.days[0].et0).toBe(4.25)
  })

  it('network down and no cache → bundled snapshot for the demo farm', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    const r = await getForecast(24.21, 55.74)
    expect(r.source).toBe('snapshot')
    expect(r.days.length).toBeGreaterThan(5)
  })

  it('network down, no cache, unknown place → error (the UI shows a message, never a blank screen)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    await expect(getForecast(10, 10)).rejects.toThrow()
  })
})
