import { AnimatePresence, m } from 'motion/react'
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { IconCompare, IconFarm, IconReplay, IconTomorrow, IconWorker } from './components/icons'
import { EASE } from './components/motion'
import { useApp } from './state'
import { timeAgo } from './lib/format'
import { hasToured } from './lib/tour'
import Tomorrow from './screens/Tomorrow'
import Backdrop from './components/Backdrop'
import { useDemo } from './demo/Demo'

const Tour = lazy(() => import('./screens/Tour'))
const Welcome = lazy(() => import('./screens/Welcome'))
const Compare = lazy(() => import('./screens/Compare'))
const Replay = lazy(() => import('./screens/Replay'))
const Worker = lazy(() => import('./screens/Worker'))
const Setup = lazy(() => import('./screens/Setup'))
const Why = lazy(() => import('./screens/Why'))

type Route = 'welcome' | 'tour' | 'tomorrow' | 'compare' | 'replay' | 'worker' | 'farm' | 'why'

const TABS: { id: Route; label: string; short: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: 'tomorrow', label: 'Tomorrow', short: 'Tomorrow', Icon: IconTomorrow },
  { id: 'compare', label: 'Habit vs Namak', short: 'vs Habit', Icon: IconCompare },
  { id: 'replay', label: 'Season Replay', short: 'Replay', Icon: IconReplay },
  { id: 'worker', label: 'Worker', short: 'Worker', Icon: IconWorker },
  { id: 'farm', label: 'Farm', short: 'Farm', Icon: IconFarm },
]

const ROUTES: Route[] = ['welcome', 'tour', 'tomorrow', 'compare', 'replay', 'worker', 'farm', 'why']
function readRoute(): Route {
  const h = window.location.hash.replace('#', '') as Route
  if (ROUTES.includes(h)) return h
  // First visit with no deep link: the welcome screen (demo or explore). Afterwards: the dashboard.
  return hasToured() ? 'tomorrow' : 'welcome'
}

function StatusBanner() {
  const { online, forecast, forecastError, forecastLoading } = useApp()
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
  const { farm } = useApp()
  const demo = useDemo()

  useEffect(() => {
    const on = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  if (route === 'welcome')
    return (
      <Suspense fallback={<div className="min-h-dvh bg-night" />}>
        <Welcome />
      </Suspense>
    )
  if (route === 'tour')
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
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden text-[12px] text-ink/65 lg:inline">
              {farm.name} · {farm.place}
            </span>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {[...TABS, { id: 'why' as Route, label: 'Why it works', short: 'Why', Icon: IconTomorrow }].map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                aria-current={route === t.id ? 'page' : undefined}
                className={`rounded-full px-3 py-2 text-[13px] font-medium transition-colors duration-300 ${route === t.id ? 'bg-black/[0.06] text-ink' : 'text-ink/65 hover:bg-black/[0.03] hover:text-ink'}`}
              >
                {t.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href="#why" className="inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-ink/70 md:hidden">
              Why it works
            </a>
            <a href="#tour" className="hidden min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-ink/70 hover:text-ink sm:inline-flex">
              Story
            </a>
            <button onClick={demo.running ? demo.stop : demo.start} className="group inline-flex min-h-11 items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white transition-transform group-hover:scale-[1.03]">
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-[rgba(251,251,253,0.8)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-[1.8] md:hidden"
        aria-label="Main"
      >
        <ul className="grid grid-cols-5">
          {TABS.map(({ id, short, Icon }) => {
            const active = route === id
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-teal-water' : 'text-ink/65'}`}
                >
                  <Icon className={`h-[22px] w-[22px] ${active ? 'stroke-[2.2]' : ''}`} />
                  {short}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
