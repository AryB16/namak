/**
 * Hero background: tiny salt crystals drifting upward. They scatter away from the cursor (or finger) and glow
 * water-teal near it, then drift back. One canvas, ~140 particles, paused when off-screen; static for reduced motion.
 */
import { useEffect, useRef } from 'react'

interface P {
  x: number
  y: number
  vx: number
  vy: number
  s: number
  a: number
  r: number
  vr: number
}

export default function SaltField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let ps: P[] = []
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const mouse = { x: -9999, y: -9999, on: false }

    const seed = () => {
      const r = c.getBoundingClientRect()
      w = r.width
      h = r.height
      c.width = w * dpr
      c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(Math.min(160, (w * h) / 9000))
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        s: 1.2 + Math.random() * 2.6,
        a: 0.15 + Math.random() * 0.5,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.01,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of ps) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d2 = dx * dx + dy * dy
        const R = 150
        let glow = 0
        if (mouse.on && d2 < R * R) {
          const d = Math.sqrt(d2) || 1
          const f = (1 - d / R) * 1.4
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
          glow = 1 - d / R
        }
        // pushes fade out; underneath, a slow upward drift (bigger crystals rise a little faster)
        p.vx *= 0.92
        p.vy *= 0.92
        p.x += p.vx
        p.y += p.vy - 0.06 * p.s
        p.r += p.vr + p.vx * 0.01
        if (p.y < -10) {
          p.y = h + 10
          p.x = Math.random() * w
        }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.r)
        ctx.globalAlpha = Math.min(1, p.a + glow * 0.6)
        ctx.fillStyle = glow > 0.05 ? `rgb(${255 - 160 * glow},${255 - 44 * glow},${255 - 57 * glow})` : '#ffffff'
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s)
        ctx.restore()
      }
    }

    let raf = 0
    let visible = true
    const loop = () => {
      draw()
      raf = visible ? requestAnimationFrame(loop) : 0
    }
    seed()
    if (reduce) draw()
    else raf = requestAnimationFrame(loop)

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf && !reduce) raf = requestAnimationFrame(loop)
    })
    io.observe(c)

    const move = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
      mouse.on = true
    }
    const leave = () => {
      mouse.on = false
      mouse.x = mouse.y = -9999
    }
    const resize = () => seed()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />
}
