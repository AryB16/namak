/**
 * "Why salt matters", from the very start: a pinned scroll story over one soil cross-section.
 * Plain words, no numbers — the numbers come in the next sections.
 */
import { m, useMotionValueEvent, useScroll } from 'motion/react'
import { useRef, useState } from 'react'
import { EASE } from './motion'

const STEPS = [
  {
    t: 'Desert farms water from wells.',
    b: 'Rain is rare, so the water is pumped up from under the ground. That water has salt dissolved in it. You can’t see it, and you can barely taste it.',
  },
  {
    t: 'The water goes. The salt stays.',
    b: 'The plant drinks the water and the sun dries the soil. Salt can’t dry up or float away, so it is left behind in the soil.',
  },
  {
    t: 'Day after day, it piles up.',
    b: 'With too much salt around its roots, a plant struggles to drink — a bit like us drinking seawater. It stays thirsty in wet soil, and the harvest shrinks.',
  },
  {
    t: 'The fix: a little extra water.',
    b: 'Give slightly more water than the plant drinks. The extra soaks down past the roots and carries the salt away with it.',
  },
  {
    t: 'But how much extra?',
    b: 'Too little, and the salt comes back. Too much, and well water the desert can’t spare is wasted. The right amount changes with the well, the crop and every day’s weather. Farmers guess it. Namak works it out, every day.',
  },
]

// Fixed salt-grain positions inside the root zone (deterministic, so every render matches).
const GRAINS = Array.from({ length: 42 }, (_, i) => ({
  x: 70 + ((i * 53) % 260),
  y: 168 + ((i * 29) % 92),
}))
const shown = [5, 14, 42, 42, 42]
const ROOT_LINE = 272

export default function SaltBasics() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [step, setStep] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setStep(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length * 0.999)))))

  const flushed = step >= 3
  const sick = step === 2
  const leaf = sick ? '#c9a03a' : '#3f8f4a'

  return (
    <section ref={ref} data-tone="light" className="relative h-[480vh] bg-dune text-ink" aria-label="Why salt matters">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden px-6 pt-12">
        <div className="mx-auto grid w-full max-w-[1080px] items-center gap-6 md:grid-cols-[0.95fr_1.05fr] md:gap-12">
          <div className="relative order-2 min-h-[250px] md:order-1 md:min-h-[300px]">
            {STEPS.map((st, i) => (
              <m.div
                key={st.t}
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: step === i ? 1 : 0, y: step === i ? 0 : step > i ? -24 : 24 }}
                transition={{ duration: 0.55, ease: EASE }}
                aria-hidden={step !== i}
              >
                <p className="text-[15px] font-semibold text-teal-water">
                  Why salt matters <span className="font-normal text-ink/55">· {i + 1} of {STEPS.length}</span>
                </p>
                <h2 className="mt-2 text-[34px] leading-[1.05] font-semibold md:text-[52px]">{st.t}</h2>
                <p className="mt-4 max-w-[460px] text-[17px] leading-snug text-ink/75 md:text-[19px]">{st.b}</p>
                {i === 4 && (
                  <div className="mt-5 flex flex-wrap gap-2 text-[13px] font-semibold">
                    <span className="rounded-full bg-amber-warn/20 px-3 py-1.5 text-[#8a530f]">Too little → salty soil</span>
                    <span className="rounded-full bg-teal-water/15 px-3 py-1.5 text-teal-water">Just right → Namak</span>
                    <span className="rounded-full bg-red-debt/12 px-3 py-1.5 text-red-debt">Too much → wasted water</span>
                  </div>
                )}
              </m.div>
            ))}
          </div>

          <div className="order-1 mx-auto w-full max-w-[480px] md:order-2">
            <svg viewBox="0 0 400 360" className="max-h-[44svh] w-full md:max-h-none" role="img" aria-label="Soil cross-section showing salt building up around plant roots, then being washed below them">
              <defs>
                <linearGradient id="sb-soil" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#c9a77c" />
                  <stop offset="1" stopColor="#8f6c49" />
                </linearGradient>
                <linearGradient id="sb-flush" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#5fd3c6" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#5fd3c6" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#5fd3c6" stopOpacity="0" />
                </linearGradient>
                <clipPath id="sb-clip">
                  <rect x="0" y="0" width="400" height="360" rx="28" />
                </clipPath>
              </defs>
              <g clipPath="url(#sb-clip)">
                <rect width="400" height="360" fill="#f8f2e7" />
                <rect y="140" width="400" height="220" fill="url(#sb-soil)" />

                {/* sun */}
                <m.circle cx="340" cy="52" r="22" fill="#ffb547" animate={{ scale: step === 1 ? [1, 1.15, 1] : 1 }} transition={{ duration: 2, repeat: step === 1 ? Infinity : 0 }} />

                {/* root-zone line */}
                <line x1="0" x2="400" y1={ROOT_LINE} y2={ROOT_LINE} stroke="#fff" strokeOpacity="0.6" strokeDasharray="5 6" />
                <text x="14" y="162" fontSize="12" fontWeight="600" fill="#fff" fillOpacity="0.85">
                  Roots live here
                </text>
                <text x="14" y={ROOT_LINE + 20} fontSize="12" fontWeight="600" fill="#fff" fillOpacity="0.85">
                  Below the roots
                </text>

                {/* roots */}
                <g stroke="#f3e3c4" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9">
                  <path d="M200 140 C200 180 190 210 170 245" />
                  <path d="M200 140 C202 185 215 215 236 250" />
                  <path d="M200 150 C185 170 160 180 130 190" />
                  <path d="M200 150 C218 168 245 178 272 186" />
                  <path d="M200 140 L200 262" />
                </g>

                {/* plant */}
                <path d="M200 140 V88" stroke="#3f6f3a" strokeWidth="4" strokeLinecap="round" />
                <m.g style={{ originX: '200px', originY: '100px' }} animate={{ rotate: sick ? 8 : 0 }} transition={{ duration: 0.8, ease: EASE }}>
                  <m.path d="M200 100 C178 78 150 82 138 92 C158 104 182 108 200 100Z" animate={{ fill: leaf }} transition={{ duration: 0.8 }} />
                  <m.path d="M200 92 C222 70 250 74 262 84 C242 96 218 100 200 92Z" animate={{ fill: leaf }} transition={{ duration: 0.8 }} />
                  <m.path d="M200 88 C196 66 204 50 212 44 C214 62 210 78 200 88Z" animate={{ fill: leaf }} transition={{ duration: 0.8 }} />
                </m.g>

                {/* drip pipe + emitter */}
                <rect x="40" y="132" width="320" height="6" rx="3" fill="#2a2a2c" />
                {[0, 1, 2].map((d) => (
                  <m.circle
                    key={d}
                    cx="150"
                    r="4"
                    fill="#0a6f69"
                    initial={{ cy: 140, opacity: 0 }}
                    animate={step === 0 || step >= 3 ? { cy: [140, 175], opacity: [1, 0] } : { cy: 140, opacity: 0 }}
                    transition={{ duration: 1.2, repeat: step === 0 || step >= 3 ? Infinity : 0, delay: d * 0.4, ease: 'easeIn' }}
                  />
                ))}

                {/* evaporation */}
                {[110, 270].map((x, i) => (
                  <m.path
                    key={x}
                    d={`M${x} 128 c-6 -8 6 -14 0 -22 c-6 -8 6 -14 0 -22`}
                    stroke="#0a6f69"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                    initial={{ opacity: 0, y: 0 }}
                    animate={step === 1 ? { opacity: [0, 0.8, 0], y: [0, -18] } : { opacity: 0, y: 0 }}
                    transition={{ duration: 1.8, repeat: step === 1 ? Infinity : 0, delay: i * 0.6 }}
                  />
                ))}

                {/* flush band */}
                <m.rect
                  x="0"
                  width="400"
                  height="90"
                  fill="url(#sb-flush)"
                  initial={{ y: 120, opacity: 0 }}
                  animate={flushed ? { y: [130, 300], opacity: [0, 1, 0] } : { y: 120, opacity: 0 }}
                  transition={{ duration: 2.2, repeat: flushed ? Infinity : 0, ease: 'easeInOut' }}
                />

                {/* salt grains */}
                {GRAINS.map((g, i) => {
                  const on = i < shown[step]
                  const washed = flushed && i >= 6
                  return (
                    <m.rect
                      key={i}
                      width="7"
                      height="7"
                      rx="1.5"
                      fill="#ffffff"
                      stroke="#d9cbb3"
                      strokeWidth="0.8"
                      initial={false}
                      animate={{ x: washed && g.x < 140 ? g.x + 90 : g.x, y: washed ? g.y + 110 - ((i * 7) % 30) : g.y, opacity: on ? (washed ? 0.55 : 1) : 0, scale: on ? 1 : 0.4 }}
                      transition={{ duration: washed ? 1.1 : 0.45, ease: EASE, delay: on && !washed ? (i % 14) * 0.025 : (i % 10) * 0.03 }}
                    />
                  )
                })}

                {/* labels */}
                <m.g initial={false} animate={{ opacity: sick ? 1 : 0 }} transition={{ duration: 0.4 }}>
                  <rect x="252" y="196" width="128" height="30" rx="15" fill="#c0362c" />
                  <text x="316" y="216" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
                    Too salty
                  </text>
                </m.g>
                <m.g initial={false} animate={{ opacity: step === 0 ? 1 : 0 }} transition={{ duration: 0.4 }}>
                  <text x="46" y="124" fontSize="12" fontWeight="600" fill="#0a6f69">
                    salty well water
                  </text>
                </m.g>
                <m.g initial={false} animate={{ opacity: flushed ? 1 : 0 }} transition={{ duration: 0.4 }}>
                  <rect x="236" y="300" width="150" height="30" rx="15" fill="#0a6f69" />
                  <text x="311" y="320" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
                    Salt washed down
                  </text>
                </m.g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
