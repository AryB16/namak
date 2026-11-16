import { describe, expect, it } from 'vitest'
import { LANGS, instructionMatchesPlan, instructionPrompt, templateInstruction, type InstructionPlan } from './instruction'

const plan: InstructionPlan = {
  date: '2026-11-17',
  valves: [
    { n: 1, minutes: 95, start: '03:00', repayment: false },
    { n: 2, minutes: 63, start: '04:35', repayment: true },
  ],
}

describe('worker instruction', () => {
  it('English template', () => {
    expect(templateInstruction(plan, 'en')).toBe(
      'Tomorrow, open valve 1 for 95 minutes from 03:00, valve 2 for 63 minutes from 04:35. Close each valve on time and send me a photo of the EC pen in the well water. Valve 2 gets extra water to wash the salt down.',
    )
  })
  it.each(LANGS.map((l) => l.id))('%s template contains every number, so it passes its own check', (lang) => {
    const t = templateInstruction(plan, lang)
    expect(instructionMatchesPlan(t, plan)).toBe(true)
    expect(t.length).toBeLessThan(400)
  })
  it('rejects a text where the model changed a number', () => {
    expect(instructionMatchesPlan('Open valve 1 for 90 minutes from 03:00 and valve 2 for 63 minutes from 04:35.', plan)).toBe(false)
  })
  it('accepts Arabic-Indic digits', () => {
    expect(instructionMatchesPlan('الصمام ١ لمدة ٩٥ دقيقة من ٠٣:٠٠ والصمام ٢ لمدة ٦٣ دقيقة من ٠٤:٣٥', plan)).toBe(true)
  })
  it('prompt lists every valve', () => {
    const p = instructionPrompt(plan, 'ml')
    expect(p).toContain('Valve 1: 95 minutes, start 03:00')
    expect(p).toContain('Malayalam')
  })
})
