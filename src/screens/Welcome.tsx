import { motion } from 'motion/react'
import Backdrop from '../components/Backdrop'
import { EASE } from '../components/motion'
import { useDemo } from '../demo/Demo'
import { markToured } from '../lib/tour'

const chips = ['19% less water on a real year', '5 languages, by voice', 'Works offline', 'No sign-up']

export default function Welcome() {
  const demo = useDemo()
  const explore = () => {
    markToured()
    window.location.hash = 'tomorrow'
  }
  const item = (d: number) => ({
    initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.9, ease: EASE, delay: d },
  })
  return (
    <main className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-night px-6 py-16 text-center text-white">
      <Backdrop tone="dark" />
      <motion.img {...item(0)} src="/favicon.svg" alt="" width={64} height={64} className="rounded-[18px] shadow-[0_10px_40px_-8px_rgba(95,211,198,0.6)]" />
      <motion.p {...item(0.1)} className="mt-6 text-[15px] font-semibold text-glow-salt md:text-[17px]">
        Namak · for farms with salty wells
      </motion.p>
      <motion.h1 {...item(0.2)} className="mt-3 max-w-[900px] text-[48px] leading-[1.02] font-semibold tracking-[-0.04em] md:text-[88px]">
        Smarter watering
        <br />
        <span className="bg-gradient-to-r from-glow-water to-[#b7f0e8] bg-clip-text text-transparent">for salty wells.</span>
      </motion.h1>
      <motion.p {...item(0.35)} className="mt-6 max-w-[560px] text-[19px] leading-snug text-white/70 md:text-[22px]">
        Namak tells the farm worker exactly how long to open each valve tomorrow — using less water and keeping salt out of
        the soil.
      </motion.p>

      <motion.div {...item(0.5)} className="mt-10 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:justify-center">
        <motion.button
          onClick={demo.start}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex min-h-14 items-center justify-center gap-3 rounded-full bg-white px-7 text-[17px] font-semibold text-ink shadow-[0_12px_50px_-12px_rgba(95,211,198,0.8)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-water text-[11px] text-white">▶</span>
          Watch the demo <span className="font-normal text-ink/60">· 60 s</span>
        </motion.button>
        <motion.button
          onClick={explore}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="min-h-14 rounded-full bg-white/10 px-7 text-[17px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/15"
        >
          Explore on my own
        </motion.button>
      </motion.div>

      <motion.a
        {...item(0.6)}
        href="#tour"
        onClick={markToured}
        className="mt-5 inline-flex min-h-11 items-center text-[15px] font-medium text-white/65 hover:text-white"
      >
        Or scroll through the story →
      </motion.a>

      <motion.ul {...item(0.75)} className="mt-12 flex max-w-[720px] flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <li key={c} className="rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[13px] text-white/75 ring-1 ring-white/10">
            {c}
          </li>
        ))}
      </motion.ul>
      <p className="absolute bottom-5 left-0 right-0 text-[12px] text-white/45">
        Illustrative demo farm · real weather from Open-Meteo · science from the UN FAO
      </p>
    </main>
  )
}
