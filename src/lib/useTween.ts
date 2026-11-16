import { useEffect, useRef, useState } from 'react'

/** Smoothly animate a number towards `target` (ease-out, ~350 ms). Respects reduced motion. */
export function useTween(target: number, ms = 350): number {
  const [v, setV] = useState(target)
  const from = useRef(target)
  const raf = useRef(0)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(target)) {
      setV(target)
      return
    }
    const start = performance.now()
    const a = from.current
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const x = a + (target - a) * e
      from.current = x
      setV(x)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, ms])
  return v
}
