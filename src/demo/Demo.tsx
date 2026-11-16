/**
 * Guided 60-second demo: moves through the real screens, highlights what it talks about, and triggers real actions
 * (slider sweep, voice note, EC photo read + confirm). The farm is restored when the demo ends.
 */
import { AnimatePresence, m } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { EASE } from '../components/motion'
import { markToured } from '../lib/tour'
import { useApp } from '../state'
import type { Farm } from '../engine/plan'
import { DEMO_FARM } from '../data/demoFarm'

export type DemoEventType = 'sweep-slider' | 'send-note' | 'read-sample' | 'play-replay'

// Screens load on demand, so an action may be sent before its screen exists. Keep the latest one for a few seconds and
// let the screen pick it up when it mounts.
let pending: { type: DemoEventType; at: number } | null = null

export function emitDemo(type: DemoEventType) {
  pending = { type, at: Date.now() }
  window.dispatchEvent(new CustomEvent('namak:demo', { detail: type }))
}

/** Screens subscribe to demo actions with this hook. */
export function useDemoEvent(type: DemoEventType, handler: () => void) {
  const h = useRef(handler)
  h.current = handler
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent).detail === type) {
        pending = null
        h.current()
      }
    }
    window.addEventListener('namak:demo', on)
    // Mounted after the action was sent? Run it now (if it is recent).
    if (pending && pending.type === type && Date.now() - pending.at < 5000) {
      pending = null
      const t = window.setTimeout(() => h.current(), 250)
      return () => {
        window.clearTimeout(t)
        window.removeEventListener('namak:demo', on)
      }
    }
    return () => window.removeEventListener('namak:demo', on)
  }, [type])
}

interface Step {
  route: string
  target: string
  caption: string
  ms: number
  event?: DemoEventType
  eventDelay?: number
}

export const STEPS: Step[] = [
  { route: 'tomorrow', target: 'hero', caption: 'This is tomorrow’s watering plan for an example farm near Al Ain. Namak works it out from the weather forecast.', ms: 6500 },
  { route: 'tomorrow', target: 'valves', caption: 'Each valve is a tap that waters one part of the farm. Namak gives each one exact minutes: enough for the plants, plus a little extra to wash away salt.', ms: 6500 },
  { route: 'compare', target: 'slider', caption: 'The well water here is salty. Watch what happens as it gets saltier: more and more water is needed just to wash the salt away.', ms: 9000, event: 'sweep-slider', eventDelay: 900 },
  { route: 'compare', target: 'counters', caption: 'Over a real year, Namak uses about 19% less water than the worker’s usual routine, and keeps every crop healthy.', ms: 6000 },
  { route: 'replay', target: 'replay-chart', caption: 'We replayed last year with real weather. Orange is the usual routine and teal is Namak. With the routine, salt piles up in the soil all summer.', ms: 9000, event: 'play-replay', eventDelay: 300 },
  { route: 'worker', target: 'phone', caption: 'On the farmer’s phone, Namak asks for a photo of a cheap salt meter in well water. Gemini reads the number, the farmer confirms, and the plan updates.', ms: 10000, event: 'read-sample', eventDelay: 600 },
  { route: 'worker', target: 'phone', caption: 'Then Gemini writes tomorrow’s watering times in the farmer’s language and reads them out as a voice message.', ms: 12000, event: 'send-note', eventDelay: 300 },
]

interface DemoCtx {
  running: boolean
  start: () => void
  stop: () => void
}

const Ctx = createContext<DemoCtx>({ running: false, start: () => {}, stop: () => {} })
export const useDemo = () => useContext(Ctx)

function clearHighlights() {
  document.querySelectorAll('[data-demo-active]').forEach((el) => el.removeAttribute('data-demo-active'))
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const { farm, setFarm, setDemoDay } = useApp()
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const snapshot = useRef<Farm | null>(null)

  const start = useCallback(() => {
    markToured()
    if (!snapshot.current) snapshot.current = farm
    // Run on the demo farm and the recorded demo day, so every number matches the saved AI voice messages.
    setFarm(DEMO_FARM)
    setDemoDay(true)
    setFinished(false)
    setPaused(false)
    setStep(0)
    setRunning(true)
  }, [farm, setFarm, setDemoDay])

  const restore = useCallback(() => {
    setDemoDay(false)
    if (snapshot.current) setFarm(snapshot.current)
    snapshot.current = null
  }, [setFarm, setDemoDay])

  const stop = useCallback(() => {
    clearHighlights()
    setRunning(false)
    setFinished(false)
    restore()
    if (window.location.hash !== '#tomorrow') window.location.hash = 'tomorrow'
  }, [restore])

  // The demo changes the farm (EC photo); put it back as soon as the demo ends.
  useEffect(() => {
    if (finished) restore()
  }, [finished, restore])

  // Run the current step: navigate, highlight, trigger its action.
  useEffect(() => {
    if (!running || finished) return
    const s = STEPS[step]
    if (window.location.hash !== `#${s.route}`) window.location.hash = s.route
    const timers: number[] = []
    // Screens load lazily: keep looking for the target for up to ~3 s.
    let tries = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-demo="${s.target}"]`)
      if (el) {
        clearHighlights()
        el.setAttribute('data-demo-active', 'true')
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (tries++ < 20) timers.push(window.setTimeout(find, 150))
    }
    timers.push(window.setTimeout(find, 350))
    if (s.event) timers.push(window.setTimeout(() => emitDemo(s.event!), 450 + (s.eventDelay ?? 0)))
    return () => timers.forEach(clearTimeout)
  }, [running, step, finished])

  // Advance automatically unless paused.
  useEffect(() => {
    if (!running || paused || finished) return
    const t = window.setTimeout(() => {
      if (step < STEPS.length - 1) setStep(step + 1)
      else {
        clearHighlights()
        setFinished(true)
      }
    }, STEPS[step].ms)
    return () => clearTimeout(t)
  }, [running, paused, step, finished])

  useEffect(() => {
    if (!running) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, stop])

  return (
    <Ctx.Provider value={{ running, start, stop }}>
      {children}
      <AnimatePresence>
        {running && !finished && (
          <DemoBar
            key="bar"
            step={step}
            paused={paused}
            onPause={() => setPaused((p) => !p)}
            onNext={() => (step < STEPS.length - 1 ? setStep(step + 1) : setFinished(true))}
            onExit={stop}
          />
        )}
        {running && finished && <DemoEnd key="end" onExplore={stop} onAgain={start} />}
      </AnimatePresence>
    </Ctx.Provider>
  )
}

function DemoBar({ step, paused, onPause, onNext, onExit }: { step: number; paused: boolean; onPause: () => void; onNext: () => void; onExit: () => void }) {
  const s = STEPS[step]
  return (
    <m.div
      role="dialog"
      aria-label="Guided demo"
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[620px] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[420px]"
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <div className="rounded-[24px] bg-[rgba(20,20,22,0.86)] p-4 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl md:p-5">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              {i < step && <div className="h-full w-full bg-white" />}
              {i === step && (
                <m.div
                  key={`${step}-${paused}`}
                  className="h-full bg-glow-water"
                  initial={{ width: paused ? '50%' : '0%' }}
                  animate={{ width: paused ? '50%' : '100%' }}
                  transition={{ duration: paused ? 0 : STEPS[step].ms / 1000, ease: 'linear' }}
                />
              )}
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <m.p
            key={step}
            className="mt-3.5 text-[16px] leading-snug md:text-[17px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            aria-live="polite"
          >
            {s.caption}
          </m.p>
        </AnimatePresence>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[13px] text-white/60 tabular">
            {step + 1} / {STEPS.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={onPause} className="min-h-11 rounded-full px-4 text-[14px] font-semibold text-white/85 hover:bg-white/10">
              {paused ? 'Play' : 'Pause'}
            </button>
            <button onClick={onNext} className="min-h-11 rounded-full bg-white px-4 text-[14px] font-semibold text-ink">
              Next ›
            </button>
            <button onClick={onExit} aria-label="Exit demo" className="min-h-11 min-w-11 rounded-full text-[18px] text-white/70 hover:bg-white/10">
              ✕
            </button>
          </div>
        </div>
      </div>
    </m.div>
  )
}

function DemoEnd({ onExplore, onAgain }: { onExplore: () => void; onAgain: () => void }) {
  return (
    <m.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <m.div
        role="dialog"
        aria-label="Demo finished"
        className="w-full max-w-[480px] rounded-[32px] bg-night p-8 text-center text-white ring-1 ring-white/10"
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <p className="text-[15px] font-semibold text-glow-water">That’s Namak in 60 seconds</p>
        <h2 className="mt-2 text-[34px] leading-tight font-semibold">Less water. Healthier soil. A plan the worker can hear.</h2>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={onExplore} className="min-h-12 rounded-full bg-white px-6 text-[16px] font-semibold text-ink">
            Explore on my own
          </button>
          <button onClick={onAgain} className="min-h-12 rounded-full px-6 text-[16px] font-semibold text-white/85 ring-1 ring-white/25">
            Watch again
          </button>
        </div>
      </m.div>
    </m.div>
  )
}
