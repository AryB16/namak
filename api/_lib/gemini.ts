/**
 * Minimal Gemini client (REST, Interactions API) — server-side only.
 * Docs read on 16 Nov 2026: ai.google.dev/gemini-api/docs/{models,structured-output,image-understanding,speech-generation}
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions, header x-goog-api-key, Api-Revision 2026-05-20.
 * The key comes from process.env.GEMINI_API_KEY and is never logged or returned.
 */

const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-4-hydrogen'
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts'

export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

interface Step {
  type: string
  content?: { type: string; text?: string; data?: string; mime_type?: string }[]
}

export async function interact(body: unknown, timeoutMs = 20_000): Promise<{ steps?: Step[] }> {
  // Trim: a key pasted into `vercel env add` can carry a trailing newline or quotes.
  const key = (process.env.GEMINI_API_KEY || '')
    .trim()
    .replace(/^GEMINI_API_KEY\s*=\s*/, '')
    .replace(/^["']|["']$/g, '')
    .trim()
  if (!key) throw new GeminiError('AI not configured', 503)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      // Google's error text never contains the key; log its status + message (truncated) for debugging.
      const detail = await res.text().then((t) => {
        try {
          const j = JSON.parse(t)
          const e = Array.isArray(j) ? j[0]?.error : j.error
          return e ? `${e.status ?? ''} ${String(e.message ?? '').slice(0, 160)}` : t.slice(0, 160)
        } catch {
          return t.slice(0, 120)
        }
      })
      throw new GeminiError(`Gemini HTTP ${res.status} ${detail}`, res.status === 429 ? 429 : 502)
    }
    return (await res.json()) as { steps?: Step[] }
  } catch (e) {
    if (e instanceof GeminiError) throw e
    throw new GeminiError(ctrl.signal.aborted ? 'Gemini timeout' : 'Gemini unreachable', 504)
  } finally {
    clearTimeout(t)
  }
}

const outputs = (d: { steps?: Step[] }) => (d.steps ?? []).filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? [])

export function outputText(d: { steps?: Step[] }): string {
  return outputs(d)
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
    .trim()
}

export function outputAudio(d: { steps?: Step[] }): { data: string; mime: string } | null {
  const a = outputs(d).filter((c) => c.type === 'audio' && c.data)
  const last = a[a.length - 1]
  return last ? { data: last.data!, mime: last.mime_type || 'audio/wav' } : null
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  })
}
