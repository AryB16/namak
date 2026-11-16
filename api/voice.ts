/**
 * POST /api/voice  { text, lang }  →  audio/wav (Gemini TTS)
 * Errors return JSON with status ≥ 400; the client then uses the browser's speechSynthesis or a committed sample.
 */
import { LANGS } from '../src/lib/instruction'
import { TTS_MODEL, interact, json, outputAudio } from './_lib/gemini'
import { checkLimit } from './_lib/limit'

export async function POST(req: Request): Promise<Response> {
  let text = ''
  let lang = ''
  try {
    const b = (await req.json()) as { text?: string; lang?: string }
    text = String(b.text ?? '').trim()
    lang = String(b.lang ?? '')
  } catch {
    /* fallthrough */
  }
  if (!text || text.length > 600 || !LANGS.some((l) => l.id === lang)) return json({ error: 'bad request' }, 400)

  const lim = checkLimit(req, 'voice', 6)
  if (!lim.ok) return json({ error: lim.reason }, 429)

  try {
    const d = await interact(
      {
        model: TTS_MODEL,
        input: [
          {
            type: 'user_input',
            content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: 'calm, clear and friendly, unhurried, like a supervisor giving instructions' }] }],
          },
        ],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: 'Kore' }] },
      },
      45_000,
    )
    const audio = outputAudio(d)
    if (!audio) return json({ error: 'no audio' }, 502)
    const bytes = Buffer.from(audio.data, 'base64')
    return new Response(bytes, {
      status: 200,
      headers: { 'Content-Type': audio.mime.startsWith('audio/') ? audio.mime : 'audio/wav', 'Cache-Control': 'no-store', 'X-Model': TTS_MODEL },
    })
  } catch (e) {
    console.error('voice failed:', (e as Error).message)
    return json({ error: 'voice unavailable' }, 502)
  }
}
