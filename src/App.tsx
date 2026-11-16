import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { IconCompare, IconFarm, IconInfo, IconReplay, IconTomorrow, IconWorker } from './components/icons'
import { useApp } from './state'
import { timeAgo } from './lib/format'
import Tomorrow from './screens/Tomorrow'

const Compare = lazy(() => import('./screens/Compare'))
const Replay = lazy(() => import('./screens/Replay'))
const Worker = lazy(() => import('./screens/Worker'))
const Setup = lazy(() => import('./screens/Setup'))
const Why = lazy(() => import('./screens/Why'))

type Route = 'tomorrow' | 'compare' | 'replay' | 'worker' | 'farm' | 'why'

const TABS: { id: Route; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: 'tomorrow', label: 'Tomorrow', Icon: IconTomorrow },
  { id: 'compare', label: 'vs Habit', Icon: IconCompare },
  { id: 'replay', label: 'Replay', Icon: IconReplay },
  { id: 'worker', label: 'Worker', Icon: IconWorker },
  { id: 'farm', label: 'Farm', Icon: IconFarm },
]

const ROUTES: Route[] = ['tomorrow', 'compare', 'replay', 'worker', 'farm', 'why']

function readRoute(): Route {
  const h = window.location.hash.replace('#', '') as Route
  return ROUTES.includes(h) ? h : 'tomorrow'
}

export function go(r: Route) {
  window.location.hash = r
}

function StatusBanner() {
  const { online, forecast, forecastError } = useApp()
  if (forecastError && !forecast)
    return <div className="bg-red-debt px-4 py-2 text-center text-sm font-semibold text-salt">{forecastError}</div>
  if (!forecast) return null
  if (!online || forecast.source !== 'live') {
    const what = forecast.source === 'snapshot' ? 'showing the saved demo forecast' : `plan synced ${timeAgo(forecast.fetchedAt)}`
    return (
      <div className="bg-amber-warn px-4 py-2 text-center text-sm font-semibold text-ink" role="status">
        {online ? 'Forecast unavailable' : 'Offline'} — {what}
      </div>
    )
  }
  return null
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const { farm } = useApp()

  useEffect(() => {
    const on = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  return (
    <div className="min-h-dvh pb-[calc(76px+env(safe-area-inset-bottom))]">
      <StatusBanner />
      <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-5 pb-2">
        <a href="#tomorrow" className="flex items-center gap-2.5" aria-label="Namak home">
          <img src="/favicon.svg" alt="" width={36} height={36} className="rounded-xl" />
          <div className="leading-tight">
            <p className="font-display text-xl font-semibold text-teal-deep">Namak</p>
            <p className="text-[11px] text-ink/70">
              {farm.name} · {farm.place}
            </p>
          </div>
        </a>
        <a
          href="#why"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl px-3 text-sm font-semibold ${route === 'why' ? 'bg-teal-water text-salt' : 'text-teal-water ring-1 ring-teal-water/25'}`}
        >
          <IconInfo className="h-4 w-4" /> Why it works
        </a>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-8">
        <Suspense fallback={<p className="py-20 text-center text-ink/65">Loading…</p>}>
          {route === 'tomorrow' && <Tomorrow />}
          {route === 'compare' && <Compare />}
          {route === 'replay' && <Replay />}
          {route === 'worker' && <Worker />}
          {route === 'farm' && <Setup />}
          {route === 'why' && <Why />}
        </Suspense>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-salt/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Main"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map(({ id, label, Icon }) => {
            const active = route === id
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold leading-tight ${active ? 'text-teal-water' : 'text-ink/65'}`}
                >
                  <Icon className={`h-6 w-6 ${active ? 'stroke-[2.2]' : ''}`} />
                  {label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
