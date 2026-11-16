import { AnimatePresence, m } from 'motion/react'
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { IconCompare, IconGear, IconInfo, IconSpark, IconTomorrow } from './components/icons'
import { EASE } from './components/motion'
import { useApp } from './state'
import { timeAgo } from './lib/format'
import { hasToured } from './lib/tour'
import Tomorrow from './screens/Tomorrow'
import Backdrop from './components/Backdrop'
import { useDemo } from './demo/Demo'

const Tour = lazy(() => import('./screens/Tour'))
const Compare = lazy(() => import('./screens/Compare'))
const Replay = lazy(() => import('./screens/Replay'))
const Worker = lazy(() => import('./screens/Worker'))
const Setup = lazy(() => import('./screens/Setup'))
const Why = lazy(() => import('./screens/Why'))

type Route = 'welcome' | 'tour' | 'tomorrow' | 'compare' | 'replay' | 'worker' | 'farm' | 'why'

type Tab = { id: Route; label: string; short: string; also?: Route[]; Icon: ComponentType<{ className?: string }>; ai?: boolean }
const TABS: Tab[] = [
  { id: 'tomorrow', label: 'Plan', short: 'Plan', Icon: IconTomorrow },
  { id: 'compare', label: 'Results', short: 'Results', also: ['replay'], Icon: IconCompare },
  { id: 'worker', label: 'AI assistant', short: 'AI assistant', Icon: IconSpark, ai: true },
  { id: 'why', label: 'How it works', short: 'How it works', Icon: IconInfo },
]
const isActive = (t: Tab, r: Route) => t.id === r || !!t.also?.includes(r)

const ROUTES: Route[] = ['welcome', 'tour', 'tomorrow', 'compare', 'replay', 'worker', 'farm', 'why']
function readRoute(): Route {
  const h = window.location.hash.replace('#', '') as Route
  if (ROUTES.includes(h)) return h
  // First visit with no deep link: the welcome screen (demo or explore). Afterwards: the dashboard.
  return hasToured() ? 'tomorrow' : 'welcome'
}

function StatusBanner() {
  const { online, forecast, forecastError, forecastLoading, liveData } = useApp()
  if (!liveData)
    return online ? null : (
      <div className="bg-amber-warn px-4 py-2 text-center text-[13px] font-semibold text-ink" role="status">
        Offline — everything still works with the saved data
      </div>
    )
  // Don't flash a warning while a cached plan is shown and the live forecast is still on its way.
  if (online && forecastLoading) return null
  let msg: string | null = null
  let tone = 'bg-amber-warn text-ink'
  if (forecastError && !forecast) {
    msg = forecastError
    tone = 'bg-red-debt text-white'
  } else if (forecast && (!online || forecast.source !== 'live')) {
    const what = forecast.source === 'snapshot' ? 'showing the saved demo forecast' : `plan synced ${timeAgo(forecast.fetchedAt)}`
    msg = `${online ? 'Forecast unavailable' : 'Offline'} — ${what}`
  }
  if (!msg) return null
  return (
    <div className={`px-4 py-2 text-center text-[13px] font-semibold ${tone}`} role="status">
      {msg}
    </div>
  )
}

function Logo() {
  return (
    <a href="#tomorrow" className="flex min-h-11 items-center gap-2" aria-label="Namak home">
      <img src="/favicon.svg" alt="" width={26} height={26} className="rounded-[8px]" />
      <span className="text-[17px] font-semibold tracking-tight">Namak</span>
    </a>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const demo = useDemo()

  useEffect(() => {
    const on = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  // First visit and #tour: the story page. Its first screen offers the guided demo or the farm; scrolling tells the story.
  if (route === 'welcome' || route === 'tour')
    return (
      <Suspense fallback={<div className="min-h-dvh bg-night" />}>
        <Tour />
      </Suspense>
    )

  return (
    <div className="min-h-dvh pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
      <Backdrop />
      <StatusBanner />
      <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-[rgba(251,251,253,0.72)] backdrop-blur-xl backdrop-saturate-[1.8]">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-3 px-4 md:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {TABS.map((t) => {
              const active = isActive(t, route)
              return t.ai ? (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`ai-pill inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-white ${active ? 'ring-2 ring-offset-2 ring-[#8a6bff]/50 ring-offset-[#fbfbfd]' : ''}`}
                >
                  <IconSpark className="h-3.5 w-3.5" /> {t.label}
                </a>
              ) : (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium transition-colors duration-300 ${active ? 'bg-black/[0.06] text-ink' : 'text-ink/65 hover:bg-black/[0.03] hover:text-ink'}`}
                >
                  {t.label}
                </a>
              )
            })}
          </nav>
          <div className="flex items-center gap-1">
            <a
              href="#farm"
              aria-label="Farm settings"
              title="Farm settings"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors ${route === 'farm' ? 'bg-black/[0.06] text-ink' : 'text-ink/60 hover:bg-black/[0.04] hover:text-ink'}`}
            >
              <IconGear className="h-5 w-5" />
            </a>
            <button onClick={demo.running ? demo.stop : demo.start} className="group inline-flex min-h-11 items-center">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white transition-transform group-hover:scale-[1.03]">
                {demo.running ? 'End demo' : '▶ Demo'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <m.main
          key={route}
          className="mx-auto max-w-[1080px] px-4 pt-6 pb-10 md:px-6 md:pt-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          <Suspense fallback={<p className="py-24 text-center text-ink/65">Loading…</p>}>
            {route === 'tomorrow' && <Tomorrow />}
            {route === 'compare' && <Compare />}
            {route === 'replay' && <Replay />}
            {route === 'worker' && <Worker />}
            {route === 'farm' && <Setup />}
            {route === 'why' && <Why />}
          </Suspense>
        </m.main>
      </AnimatePresence>

      <footer className="mx-auto hidden max-w-[1080px] px-6 pb-10 text-[12px] text-ink/65 md:block">
        Weather: Open-Meteo (live forecast, ERA5 history). Crop and salt science: FAO Irrigation & Drainage Papers 29, 56, 61.
        Demo farm, well EC and prices are illustrative.
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-[rgba(251,251,253,0.85)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-[1.8] md:hidden"
        aria-label="Main"
      >
        <ul className="grid grid-cols-4">
          {TABS.map((t) => {
            const active = isActive(t, route)
            return (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${t.ai ? '' : active ? 'text-teal-water' : 'text-ink/60'}`}
                >
                  {t.ai ? (
                    <>
                      <span className={`ai-pill flex h-8 w-12 items-center justify-center rounded-full text-white ${active ? 'ring-2 ring-[#8a6bff]/40' : ''}`}>
                        <t.Icon className="h-4 w-4" />
                      </span>
                      <span className="ai-text">{t.short}</span>
                    </>
                  ) : (
                    <>
                      <span className="flex h-8 items-center">
                        <t.Icon className={`h-[22px] w-[22px] ${active ? 'stroke-[2.2]' : ''}`} />
                      </span>
                      {t.short}
                    </>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
