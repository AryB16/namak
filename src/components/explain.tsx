import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { EASE, Stagger, StaggerItem } from './motion'

/** Plain-English definitions for the few technical words we cannot avoid. */
export const GLOSSARY: Record<string, string> = {
  'salt debt':
    'Salty water leaves a little salt in the soil every day. Like a debt, it builds up. It has to be “paid back” by washing it below the roots with extra water.',
  'dS/m':
    'deciSiemens per metre — the unit for how salty water or soil is. Higher means saltier. Water under 0.7 counts as fresh for farming (UN FAO).',
  valve: 'A tap on the farm’s pipe network. Each valve waters one block of crops through small drippers.',
  'salt meter':
    'An EC pen: a pocket meter (about AED 100) that measures how salty water is. You dip it in a cup of well water and read the number.',
  'safe level': 'The most salt this crop can take in its root soil before it starts to grow less (from UN FAO research).',
  'wash out': 'Giving a little more water than the plant drinks, so the extra drains down and carries salt below the roots.',
}

/** Dotted-underlined word with a plain-English explanation on hover, focus or tap. */
export function Term({ k, children, dark = false }: { k: keyof typeof GLOSSARY | string; children?: ReactNode; dark?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        className={`cursor-help underline decoration-dotted decoration-2 underline-offset-4 ${dark ? 'decoration-white/50' : 'decoration-teal-water/50'}`}
      >
        {children ?? k}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute bottom-full left-1/2 z-40 mb-2 w-[260px] -translate-x-1/2 rounded-2xl bg-ink px-3.5 py-2.5 text-left text-[13px] leading-snug font-normal text-white shadow-xl"
          >
            {GLOSSARY[k as string] ?? ''}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

const STEPS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
    title: 'Checks tomorrow’s weather',
    body: 'Hotter, windier days make plants thirstier. Namak reads the live forecast for the farm.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 3c-3.5 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2.5-6-6-11z" />
        <path d="M9 15h6" />
      </svg>
    ),
    title: 'Adds just enough to wash out salt',
    body: 'Well water here is salty. A little extra water carries the salt below the roots — not too little, not too much.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M9.5 13.5c1-1.5 1.5-1.5 2.5 0s1.5 1.5 2.5 0" />
      </svg>
    ),
    title: 'Tells the worker, by voice',
    body: 'The person who opens the taps gets the exact minutes as a voice note, in their own language.',
  },
]

/** “How Namak works” — three steps for someone who has never heard of the idea. */
export function HowItWorks() {
  return (
    <Stagger className="grid gap-3 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <StaggerItem key={s.title} className="glass flex gap-4 rounded-[24px] p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-water/10 text-teal-water">{s.icon}</div>
          <div>
            <p className="text-[13px] font-semibold text-ink/65">Step {i + 1}</p>
            <p className="text-[17px] leading-tight font-semibold">{s.title}</p>
            <p className="mt-1 text-[14px] leading-snug text-ink/70">{s.body}</p>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  )
}

/** Collapsible “the maths” block so technical detail never crowds the main message. */
export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group mt-3 rounded-2xl bg-black/[0.03] px-4 py-2 text-[13px] text-ink/70 open:pb-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold text-ink/75">
        {summary}
        <span className="transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="leading-relaxed">{children}</div>
    </details>
  )
}
