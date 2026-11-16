// Generates the demo's AI content ONCE (Gemini, server-side, with the key from .env.local) and saves it in the repo:
//  - the worker message for the demo day in 5 languages (Gemini text, checked number-by-number like /api/instruct)
//  - its voice note in each language (Gemini TTS) -> public/demo/voice-<lang>.m4a
//  - Gemini's reading of each example salt-meter photo -> src/data/demoAssets.json
// The app replays these, so the demo never waits on (or pays for) the AI.
// Usage: set -a; . ./.env.local; set +a; npx tsx scripts/make-demo-assets.mts
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEMO_FARM } from '../src/data/demoFarm.ts'
import fc from '../src/data/snapshot-forecast.json' with { type: 'json' }
import { planFarm } from '../src/engine/farm.ts'
import type { WeatherDay } from '../src/engine/plan.ts'
import { LANGS, instructionMatchesPlan, instructionPrompt, templateInstruction } from '../src/lib/instruction.ts'
import { instructionPlan } from '../src/lib/worker.ts'

const KEY = process.env.GEMINI_API_KEY!
const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const post = async (body: unknown) => {
  const r = await fetch(URL, { method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as { steps: { type: string; content?: { type: string; text?: string; data?: string }[] }[] }
}
const outputs = (d: Awaited<ReturnType<typeof post>>) => d.steps.filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? [])

export const DEMO_DAYS = (fc.days as WeatherDay[]).slice(1, 8)
const tmp = mkdtempSync(join(tmpdir(), 'namak-demo-'))

// Readings of the example photos: reuse the saved Gemini readings unless --rescan is given.
const existing = existsSync('src/data/demoAssets.json') ? JSON.parse(readFileSync('src/data/demoAssets.json', 'utf8')) : null
const rescan = process.argv.includes('--rescan') || !existing?.readings

async function writeAndVoice(plan: ReturnType<typeof instructionPlan>, tag: string) {
  const out: Record<string, { text: string; source: 'gemini' | 'template' }> = {}
  for (const l of LANGS) {
    let text = templateInstruction(plan, l.id)
    let source: 'gemini' | 'template' = 'template'
    for (let attempt = 0; attempt < 3 && source === 'template'; attempt++) {
      try {
        const d = await post({
          model: 'gemini-4-hydrogen',
          input: instructionPrompt(plan, l.id),
          generation_config: { thinking_level: 'low' },
          response_format: { type: 'text', mime_type: 'application/json', schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
        })
        const t = String(JSON.parse(outputs(d).filter((c) => c.type === 'text').map((c) => c.text).join('')).text ?? '').trim()
        if (t && t.length <= 600 && instructionMatchesPlan(t, plan)) {
          text = t
          source = 'gemini'
        }
      } catch (e) {
        console.log(tag, l.id, 'text attempt failed', (e as Error).message)
      }
    }
    const d = await post({
      model: 'gemini-3.8-flash-lite-tts',
      input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: 'calm, clear and friendly, unhurried, like a supervisor giving instructions' }] }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    })
    const audio = outputs(d).filter((c) => c.type === 'audio').at(-1)!
    const wav = join(tmp, `${tag}-${l.id}.wav`)
    writeFileSync(wav, Buffer.from(audio.data!, 'base64'))
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '40000', wav, `public/demo/voice-${tag}-${l.id}.m4a`])
    out[l.id] = { text, source }
    console.log(tag, l.id, source, text.slice(0, 60))
  }
  return out
}

// Example salt-meter photos -> Gemini vision, once.
const samples = ['ec-3.82-mscm', 'ec-4210-uscm', 'ec-2.64-mscm']
const readings: Record<string, { raw: number; unit: string; ec: number; display: string; confidence: string }> = rescan ? {} : existing.readings
for (const s of rescan ? samples : []) {
  execFileSync('qlmanage', ['-t', '-s', '900', '-o', tmp, `public/samples/${s}.svg`], { stdio: 'ignore' })
  const image = readFileSync(join(tmp, `${s}.svg.png`)).toString('base64')
  const d = await post({
    model: 'gemini-4-hydrogen',
    input: [
      { type: 'text', text: 'This photo should show the display of a handheld water EC (electrical conductivity) pen or meter. Read the main number exactly as shown and its unit. If the display shows a temperature too, ignore it.' },
      { type: 'image', data: image, mime_type: 'image/png' },
    ],
    generation_config: { thinking_level: 'low' },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: { type: 'object', properties: { value: { type: 'number' }, unit: { type: 'string', enum: ['mS/cm', 'dS/m', 'µS/cm', 'ppm', 'unknown'] }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, display: { type: 'string' } }, required: ['value', 'unit', 'confidence', 'display'] },
    },
  })
  const r = JSON.parse(outputs(d).filter((c) => c.type === 'text').map((c) => c.text).join('')) as { value: number; unit: string; confidence: string; display: string }
  const ec = r.unit.replace('μ', 'µ') === 'µS/cm' ? r.value / 1000 : r.value
  readings[s] = { raw: r.value, unit: r.unit, ec: Math.round(ec * 100) / 100, display: r.display, confidence: r.confidence }
  console.log(s, JSON.stringify(readings[s]))
}

// One voice message per example reading (the farmer confirms a reading first, then the plan is made for that water).
const byReading: Record<string, { plan: ReturnType<typeof instructionPlan>; voice: Record<string, { text: string; source: 'gemini' | 'template' }> }> = {}
for (const s of samples) {
  const farm = { ...DEMO_FARM, wellEC: Math.round(readings[s].ec * 100) / 100 }
  const plan = instructionPlan(planFarm(farm, DEMO_DAYS))
  byReading[s] = { plan, voice: await writeAndVoice(plan, s) }
}

writeFileSync(
  'src/data/demoAssets.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), model: { text: 'gemini-4-hydrogen', voice: 'gemini-3.8-flash-lite-tts', vision: 'gemini-4-hydrogen' }, demoDay: DEMO_DAYS[0].date, readings, byReading }, null, 1),
)
