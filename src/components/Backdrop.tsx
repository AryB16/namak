import { useEffect, useRef } from 'react'

/**
 * Premium page backdrop (fixed, behind everything):
 *  1. soft aurora mesh — three large blurred colour fields drifting slowly (teal water, sky, warm salt);
 *  2. a fine dot grid, faint everywhere and revealed brighter around the cursor (spotlight);
 *  3. a soft teal glow that follows the cursor;
 *  4. film grain to stop gradient banding.
 * Cursor tracking writes two CSS variables in a rAF loop (no React re-renders). Fine pointers only; drift and
 * tracking stop under prefers-reduced-motion.
 */
export default function Backdrop({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia('(pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce) return
    let x = window.innerWidth / 2
    let y = window.innerHeight / 3
    let cx = x
    let cy = y
    let raf = 0
    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const tick = () => {
      // ease towards the pointer so the glow trails slightly
      cx += (x - cx) * 0.18
      cy += (y - cy) * 0.18
      el.style.setProperty('--mx', `${cx.toFixed(1)}px`)
      el.style.setProperty('--my', `${cy.toFixed(1)}px`)
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.5 ? requestAnimationFrame(tick) : 0
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    el.style.setProperty('--spot', '1')
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const dark = tone === 'dark'
  return (
    <div ref={ref} aria-hidden className={`backdrop ${dark ? 'backdrop-dark' : ''}`}>
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="aurora aurora-c" />
      <div className="dots" />
      <div className="dots-spot" />
      <div className="cursor-glow" />
      <div className="grain" />
    </div>
  )
}
