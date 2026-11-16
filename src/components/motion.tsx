import { animate, m, useInView, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

export const EASE = [0.23, 1, 0.32, 1] as const

/** Fade + rise into view once (Apple-style). Collapses to an instant fade under reduced motion. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = 'div',
  amount = 0.25,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'p' | 'h1' | 'h2'
  amount?: number
}) {
  const M = m[as] as typeof m.div
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </M>
  )
}

/** Children reveal one after another (60 ms apart, max ~5 visible steps). */
export function Stagger({ children, className, gap = 0.06 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </m.div>
  )
}

export function StaggerItem({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLMotionProps<'div'>) {
  return (
    <m.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
      {...rest}
    >
      {children}
    </m.div>
  )
}

/**
 * Number that counts up from 0 the first time it scrolls into view, then tweens to new values.
 * Writes straight to the DOM (no React re-render per frame).
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('en-US'),
  duration = 1.1,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const from = useRef(0)
  const fmt = useRef(format)
  fmt.current = format
  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduce || !Number.isFinite(value)) {
      el.textContent = fmt.current(value)
      from.current = value
      return
    }
    const ctl = animate(from.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        from.current = v
        el.textContent = fmt.current(v)
      },
    })
    return () => ctl.stop()
  }, [inView, value, reduce, duration])
  return (
    <span ref={ref} className={className}>
      {format(reduce ? value : 0)}
    </span>
  )
}
