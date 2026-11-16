// Pre-generates the demo voice notes (Gemini TTS) for the demo farm's snapshot plan, so the demo never depends on a
// live API. Usage: set -a; . ./.env.local; set +a; npx tsx scripts/make-sample-voice.mts
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEMO_FARM } from '../src/data/demoFarm.ts'
import fc from '../src/data/snapshot-forecast.json' with { type: 'json' }
import { planFarm } from '../src/engine/farm.ts'
import type { WeatherDay } from '../src/engine/plan.ts'
import { LANGS, templateInstruction } from '../src/lib/instruction.ts'
import { instructionPlan } from '../src/lib/worker.ts'

const plan = instructionPlan(planFarm(DEMO_FARM, (fc.days as WeatherDay[]).slice(1, 8)))
const tmp = mkdtempSync(join(tmpdir(), 'namak-voice-'))
const texts: Record<string, string> = {}
for (const l of LANGS) {
  const text = templateInstruction(plan, l.id)
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.8-flash-lite-tts',
      input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: 'calm, clear and friendly, unhurried, like a supervisor giving instructions' }] }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    }),
  })
  if (!res.ok) throw new Error(`${l.id}: HTTP ${res.status}`)
  const d = await res.json()
  const audio = d.steps.filter((s: { type: string }) => s.type === 'model_output').flatMap((s: { content: unknown[] }) => s.content).filter((c: { type: string }) => c.type === 'audio').at(-1)
  const wav = join(tmp, `${l.id}.wav`)
  writeFileSync(wav, Buffer.from(audio.data, 'base64'))
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '40000', wav, `public/audio/sample-${l.id}.m4a`])
  texts[l.id] = text
  console.log(l.id, 'ok')
}
writeFileSync('src/data/sampleVoice.json', JSON.stringify({ date: plan.date, plan, texts }, null, 1))
