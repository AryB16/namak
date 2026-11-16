/**
 * Worker instruction: the plan as two short sentences in the worker's language.
 * Shared by the client (offline fallback) and /api/instruct (prompt + validation).
 *
 * The non-English templates were written for this prototype and have not been checked by native speakers yet.
 */

export type Lang = 'en' | 'ar' | 'hi' | 'ur' | 'ml'

export const LANGS: { id: Lang; name: string; native: string; bcp47: string; rtl?: boolean }[] = [
  { id: 'en', name: 'English', native: 'English', bcp47: 'en-IN' },
  { id: 'ar', name: 'Arabic', native: 'العربية', bcp47: 'ar-AE', rtl: true },
  { id: 'hi', name: 'Hindi', native: 'हिन्दी', bcp47: 'hi-IN' },
  { id: 'ur', name: 'Urdu', native: 'اردو', bcp47: 'ur-PK', rtl: true },
  { id: 'ml', name: 'Malayalam', native: 'മലയാളം', bcp47: 'ml-IN' },
]

export interface InstructionValve {
  /** Valve number as painted on the valve (1, 2, 3 …). */
  n: number
  minutes: number
  start: string // HH:MM
  repayment: boolean
}

export interface InstructionPlan {
  date: string // YYYY-MM-DD
  valves: InstructionValve[]
}

const T: Record<
  Lang,
  { valve: (v: InstructionValve) => string; open: string; close: string; flush: (ns: string) => string; join: string }
> = {
  en: {
    open: 'Tomorrow, open',
    valve: (v) => `valve ${v.n} for ${v.minutes} minutes from ${v.start}`,
    join: ', ',
    close: 'Close each valve on time and send me a photo of the EC pen in the well water.',
    flush: (ns) => `Valve ${ns} gets extra water to wash the salt down.`,
  },
  ar: {
    open: 'غدًا، افتح',
    valve: (v) => `الصمام ${v.n} لمدة ${v.minutes} دقيقة من الساعة ${v.start}`,
    join: '، ثم ',
    close: 'أغلق كل صمام في وقته وأرسل لي صورة جهاز قياس الملوحة في ماء البئر.',
    flush: (ns) => `الصمام ${ns} يأخذ ماءً إضافيًا لغسل الملح.`,
  },
  hi: {
    open: 'कल',
    valve: (v) => `वाल्व ${v.n} को ${v.start} बजे से ${v.minutes} मिनट`,
    join: ', ',
    close: 'खोलें, हर वाल्व समय पर बंद करें और कुएँ के पानी में EC पेन की फोटो भेजें।',
    flush: (ns) => `वाल्व ${ns} में नमक धोने के लिए ज़्यादा पानी है।`,
  },
  ur: {
    open: 'کل',
    valve: (v) => `والو ${v.n} کو ${v.start} بجے سے ${v.minutes} منٹ`,
    join: '، ',
    close: 'کھولیں، ہر والو وقت پر بند کریں اور کنویں کے پانی میں EC پین کی تصویر بھیجیں۔',
    flush: (ns) => `والو ${ns} میں نمک دھونے کے لیے زیادہ پانی ہے۔`,
  },
  ml: {
    open: 'നാളെ',
    valve: (v) => `വാൽവ് ${v.n} ${v.start} മുതൽ ${v.minutes} മിനിറ്റ്`,
    join: ', ',
    close: 'തുറക്കുക; ഓരോ വാൽവും സമയത്ത് അടയ്ക്കുക, കിണർ വെള്ളത്തിലെ EC പെന്നിന്റെ ഫോട്ടോ അയയ്ക്കുക.',
    flush: (ns) => `വാൽവ് ${ns}-ൽ ഉപ്പ് കഴുകിക്കളയാൻ അധിക വെള്ളം ഉണ്ട്.`,
  },
}

/** Deterministic fallback instruction (no network needed). */
export function templateInstruction(plan: InstructionPlan, lang: Lang): string {
  const t = T[lang]
  const list = plan.valves.map(t.valve).join(t.join)
  const reps = plan.valves.filter((v) => v.repayment).map((v) => v.n)
  // English and Arabic put the verb first; Hindi, Urdu and Malayalam put it at the end ("…खोलें").
  const verbFirst = lang === 'en' || lang === 'ar'
  const stop = lang === 'hi' ? '।' : lang === 'ur' ? '۔' : '.'
  const first = verbFirst ? `${t.open} ${list}${stop}` : `${t.open} ${list} ${t.close.split(/[,،;]/)[0]}${stop}`
  const second = verbFirst ? t.close : t.close.slice(t.close.split(/[,،;]/)[0].length + 1).trim()
  const flush = reps.length ? ` ${t.flush(reps.join(lang === 'en' ? ' and ' : ', '))}` : ''
  return `${first} ${second}${flush}`.replace(/\s+/g, ' ').trim()
}

/** Prompt for Gemini. Numbers must stay as plain digits so the check below can verify them. */
export function instructionPrompt(plan: InstructionPlan, lang: Lang): string {
  const L = LANGS.find((l) => l.id === lang)!
  const lines = plan.valves
    .map((v) => `- Valve ${v.n}: ${v.minutes} minutes, start ${v.start}${v.repayment ? ' (includes extra water to wash salt down)' : ''}`)
    .join('\n')
  return [
    `You write voice-note instructions for a farm worker on a small desert farm. The worker may not read well; this text will be read aloud.`,
    `Write exactly two short, friendly sentences in ${L.name} (${L.native}) script.`,
    `Sentence 1: tomorrow's irrigation — for EVERY valve below, its number, its minutes and its start time.`,
    `Sentence 2: close each valve on time and send a photo of the EC pen dipped in the well water${
      plan.valves.some((v) => v.repayment)
        ? `; mention briefly that valve ${plan.valves.filter((v) => v.repayment).map((v) => v.n).join(' and ')} gets extra water to wash the salt down`
        : ''
    }.`,
    `Rules: write every number with Western digits 0-9 exactly as given (e.g. 95, 03:00). Do not add, round or change any number. No greeting, no emojis, no markdown.`,
    `Plan for tomorrow:`,
    lines,
  ].join('\n')
}

/** True if every valve's minutes and start time appear verbatim in the text (guards against the model changing numbers). */
export function instructionMatchesPlan(text: string, plan: InstructionPlan): boolean {
  const digits = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  return plan.valves.every((v) => {
    const mins = new RegExp(`(^|\\D)${v.minutes}(\\D|$)`)
    return mins.test(digits) && digits.includes(v.start)
  })
}
