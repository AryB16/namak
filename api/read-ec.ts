/**
 * POST /api/read-ec  { image: base64 (no data: prefix), mime }  →  { ec (dS/m), raw, unit, confidence, display }
 * Gemini reads the number on an EC pen's display (strict JSON schema). The server converts units and validates the
 * range; the UI always asks the owner to confirm before the farm's well EC changes.
 *   mS/cm = dS/m; µS/cm ÷ 1000 = dS/m; ppm (TDS) is rejected because the TDS factor varies by meter.
 */
import { TEXT_MODEL, interact, json, outputText } from './_lib/gemini.js'
import { checkLimit } from './_lib/limit.js'

const MAX_B64 = 3_000_000 // ~2.2 MB image

export function toDsPerM(value: number, unit: string): number | null {
  const u = unit.replace('μ', 'µ').toLowerCase()
  if (u === 'ms/cm' || u === 'ds/m') return value
  if (u === 'µs/cm' || u === 'us/cm') return value / 1000
  return null
}

export async function POST(req: Request): Promise<Response> {
  let image = ''
  let mime = 'image/jpeg'
  try {
    const b = (await req.json()) as { image?: string; mime?: string }
    image = String(b.image ?? '')
    mime = ['image/jpeg', 'image/png', 'image/webp'].includes(String(b.mime)) ? String(b.mime) : 'image/jpeg'
  } catch {
    /* fallthrough */
  }
  if (!image || image.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return json({ error: 'bad image' }, 400)

  const lim = checkLimit(req, 'read-ec', 6)
  if (!lim.ok) return json({ error: lim.reason }, 429)

  try {
    const d = await interact(
      {
        model: TEXT_MODEL,
        input: [
          {
            type: 'text',
            text:
              'This photo should show the display of a handheld water EC (electrical conductivity) pen or meter. ' +
              'Read the main number exactly as shown and its unit. If the display shows a temperature too, ignore it. ' +
              'If you cannot clearly read an EC value, set readable=false and value=0. Do not guess.',
          },
          { type: 'image', data: image, mime_type: mime },
        ],
        generation_config: { thinking_level: 'low' },
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              readable: { type: 'boolean', description: 'True only if an EC reading is clearly visible.' },
              value: { type: 'number', description: 'The number on the display, exactly as shown.' },
              unit: { type: 'string', enum: ['mS/cm', 'dS/m', 'µS/cm', 'ppm', 'unknown'] },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              display: { type: 'string', description: 'The display text as read, e.g. "3.82 mS/cm 25.1°C".' },
            },
            required: ['readable', 'value', 'unit', 'confidence', 'display'],
          },
        },
      },
      20_000,
    )
    const r = JSON.parse(outputText(d)) as { readable: boolean; value: number; unit: string; confidence: string; display: string }
    if (!r.readable) return json({ error: 'Could not read an EC value in this photo. Try again closer, without glare.', display: r.display }, 422)
    if (r.unit === 'ppm') return json({ error: 'That looks like a TDS reading in ppm. Switch the pen to EC (mS/cm) and try again.', display: r.display }, 422)
    const ec = toDsPerM(Number(r.value), r.unit === 'unknown' ? 'mS/cm' : r.unit)
    if (ec === null || !Number.isFinite(ec) || ec < 0 || ec > 20)
      return json({ error: `Read ${r.value} ${r.unit}, which is outside 0–20 dS/m. Please check the photo.`, display: r.display }, 422)
    return json({
      ec: Math.round(ec * 100) / 100,
      raw: r.value,
      unit: r.unit,
      unitAssumed: r.unit === 'unknown',
      confidence: r.confidence,
      display: r.display,
      model: TEXT_MODEL,
    })
  } catch (e) {
    const msg = (e as Error).message
    console.error('read-ec failed:', msg)
    if (msg.includes('HTTP 400')) return json({ error: 'Could not open this image. Try another photo.' }, 422)
    return json({ error: 'The AI reader is unavailable. Type the number from the pen instead.' }, 502)
  }
}
