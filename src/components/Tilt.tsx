import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { ReactNode } from 'react'

/** Card that tilts a few degrees toward the cursor, with a soft light sheen that follows it. Fine pointers only. */
export default function Tilt({ children, className = '', max = 5 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion()
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 })
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 })
  const px = useMotionValue(50)
  const py = useMotionValue(50)
  const sheen = useMotionTemplate`radial-gradient(420px circle at ${px}% ${py}%, rgba(255,255,255,0.55), transparent 55%)`
  const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

  if (reduce || !fine) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={`relative [transform-style:preserve-3d] ${className}`}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const fx = (e.clientX - r.left) / r.width
        const fy = (e.clientY - r.top) / r.height
        ry.set((fx - 0.5) * 2 * max)
        rx.set(-(fy - 0.5) * 2 * max)
        px.set(fx * 100)
        py.set(fy * 100)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
    >
      {children}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] mix-blend-soft-light" style={{ background: sheen }} />
    </motion.div>
  )
}
