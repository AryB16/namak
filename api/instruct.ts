/**
 * POST /api/instruct  { lang, plan }  →  { text, source: 'gemini' | 'template', reason? }
 * Gemini writes two short sentences in the worker's language; if it fails, is rate-limited, or changes any number,
 * the deterministic template is returned instead.
 */
import {
  LANGS,
  instructionMatchesPlan,
  instructionPrompt,
  templateInstruction,
  type InstructionPlan,
  type Lang,
} from '../src/lib/instruction.js'
import { TEXT_MODEL, interact, json, outputText } from './_lib/gemini.js'
import { checkLimit } from './_lib/limit.js'

function parse(body: unknown): { lang: Lang; plan: InstructionPlan } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { lang?: string; plan?: InstructionPlan }
  const lang = LANGS.find((l) => l.id === b.lang)?.id
  const p = b.plan
  if (!lang || !p || typeof p.date !== 'string' || !Array.isArray(p.valves) || p.valves.length < 1 || p.valves.length > 12) return null
  const valves = p.valves.map((v) => ({
    n: Math.round(Number(v.n)),
    minutes: Math.round(Number(v.minutes)),
    start: String(v.start).slice(0, 5),
    repayment: Boolean(v.repayment),
  }))
  if (valves.some((v) => !Number.isFinite(v.n) || !Number.isFinite(v.minutes) || v.minutes < 0 || v.minutes > 1440 || !/^\d\d:\d\d$/.test(v.start)))
    return null
  return { lang, plan: { date: p.date.slice(0, 10), valves } }
}

export async function POST(req: Request): Promise<Response> {
  let input: ReturnType<typeof parse> = null
  try {
    input = parse(await req.json())
  } catch {
    /* fallthrough */
  }
  if (!input) return json({ error: 'bad request' }, 400)
  const fallback = templateInstruction(input.plan, input.lang)

  const lim = checkLimit(req, 'instruct', 8)
  if (!lim.ok) return json({ text: fallback, source: 'template', reason: lim.reason })

  try {
    const d = await interact(
      {
        model: TEXT_MODEL,
        input: instructionPrompt(input.plan, input.lang),
        // Short translation task: low reasoning keeps latency down (docs: thinking_level, default high).
        generation_config: { thinking_level: 'low' },
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: { text: { type: 'string', description: 'The two-sentence instruction.' } },
            required: ['text'],
          },
        },
      },
      20_000,
    )
    const text = String(JSON.parse(outputText(d)).text ?? '').trim()
    if (!text || text.length > 600) return json({ text: fallback, source: 'template', reason: 'empty or too long' })
    if (!instructionMatchesPlan(text, input.plan))
      return json({ text: fallback, source: 'template', reason: 'AI changed a number; using the template' })
    return json({ text, source: 'gemini', model: TEXT_MODEL })
  } catch (e) {
    console.error('instruct failed:', (e as Error).message)
    return json({ text: fallback, source: 'template', reason: 'AI unavailable' })
  }
}
