import type { ReactNode } from 'react'
import { Card, Eyebrow, SourceTag } from '../components/ui'
import { CROP_LIST } from '../engine/crops'

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sand-200 py-2.5 last:border-0">
      <span className="text-[14px] text-ink/75">{k}</span>
      <span className="text-right text-[14px] font-semibold">{v}</span>
    </div>
  )
}

const SRC = {
  fao29: 'https://www.fao.org/3/t0234e/T0234E03.htm',
  fao56k: 'https://www.fao.org/3/X0490E/x0490e0b.htm',
  fao56s: 'https://www.fao.org/3/X0490E/x0490e0e.htm',
  fao61: 'https://www.fao.org/3/Y4263E/y4263e0h.htm',
  om: 'https://open-meteo.com/en/docs',
  era5: 'https://open-meteo.com/en/docs/historical-weather-api',
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-teal-water underline decoration-teal-water/30 underline-offset-2">
      {children}
    </a>
  )
}

export default function Why() {
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Why it works</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] leading-[1.05] font-semibold text-teal-deep">
          Three problems hiding inside “water the farm”.
        </h1>
      </div>

      <Card className="space-y-4">
        <Problem n="1" title="Salt is the hidden water cost">
          Desert wells are brackish. To stop salt building up, some water must drain below the roots and take the salt with
          it — the <em>leaching requirement</em>. Growers guess it: too little and the soil slowly poisons the crop, too much
          and scarce water is wasted. Namak calculates it every day.
        </Problem>
        <Problem n="2" title="Salt Debt">
          Every litre of brackish water leaves salt behind. Namak keeps a running balance of root-zone salt against each
          crop’s limit and schedules the repayment — extra leaching — on the coolest days, when the crop is using least
          water. FAO-29 supports this: leaching can be done “at each irrigation, each alternate irrigation or less
          frequently”, and should be scheduled “at periods of low crop water use”.
        </Problem>
        <Problem n="3" title="The decision-maker isn’t at the valve">
          The owner decides; a hired worker opens the valves by habit and may not read English. Namak sends tomorrow’s exact
          minutes as a voice note in the worker’s language, and the worker closes the loop with a photo of a cheap EC pen.
        </Problem>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold">The maths</h2>
        <ul className="mt-3 space-y-2.5 font-mono text-[13px] leading-relaxed text-ink/85">
          <li>ETc = Kc × ET₀ · 1 mm on 1 m² = 1 L</li>
          <li>Kc climate-adjusted: FAO-56 eq. 62 (wind, humidity, crop height)</li>
          <li>LF: holds root-zone ECe at the crop limit (FAO-29 four-layer concentration factors, FAO 1985b)</li>
          <li>cross-check: LR = ECw / (5·ECe − ECw) (FAO-29 eq. 9)</li>
          <li>Gross water = ETc / ((1 − LF) × drip efficiency) (FAO-29 eq. 7)</li>
          <li>Valve minutes = litres / (emitters × L/h) × 60</li>
          <li>Salt Debt: ΔS = (IW·ECw − R·S/W) / (1 + R/2W), four layers (FAO-61 Annex 4 eq. 21–23)</li>
          <li>Yield % = 100 − b·(ECe − threshold) (FAO-29 / FAO-56 Table 23)</li>
          <li>Target ECe: 100 % yield value if ECw &gt; 1.5 dS/m, else 90 % (FAO-29)</li>
        </ul>
        <p className="mt-3 text-[13px] text-ink/65">
          The model reproduces FAO’s published numbers: FAO-29 Example 3 (LR 0.10 / 0.16, 890 mm) and FAO-61 Table A4.1
          concentration factors (LF 0.05 → 3.2, 0.10 → 2.1, 0.15 → 1.6, 0.30 → 1.0). 70+ automated tests.
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold">Crop numbers</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-[13px]">
            <thead className="text-[11px] text-ink/55">
              <tr>
                <th className="py-1 font-semibold">Crop</th>
                <th className="font-semibold">Kc ini/mid/end</th>
                <th className="font-semibold">Salt limit</th>
                <th className="font-semibold">90 % yield</th>
                <th className="font-semibold">Slope</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {CROP_LIST.map((c) => (
                <tr key={c.id} className="border-t border-sand-200">
                  <td className="py-1.5 font-sans font-semibold">{c.name}</td>
                  <td>
                    {c.kcIni}/{c.kcMid}/{c.kcEnd}
                  </td>
                  <td>{c.ecThreshold}</td>
                  <td>{c.ec90}</td>
                  <td>{c.slopeB}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-ink/50">
          ECe in dS/m. Kc: FAO-56 Table 12. Salt limit and 90 %: FAO-29 Table 4. Slope: FAO-56 Table 23. Rhodes grass (common UAE
          fodder) is not in either salt table; Bermuda grass is used as the nearest listed fodder grass.
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold">What’s real, what’s illustrative</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceTag>Real · Live forecast · Open-Meteo</SourceTag>
          <SourceTag>Real · Historical weather · ERA5 via Open-Meteo</SourceTag>
          <SourceTag>Real · FAO crop & salt constants</SourceTag>
          <SourceTag tone="sand">Illustrative · demo farm layout</SourceTag>
          <SourceTag tone="sand">Illustrative · well EC & soil tests</SourceTag>
          <SourceTag tone="sand">Illustrative · water price</SourceTag>
          <SourceTag tone="amber">Unverified · drip efficiency 0.90</SourceTag>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold">Assumptions & limits</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink/80">
          <li>Salt model: complete mixing in four root-zone layers, 40-30-20-10 % uptake, no capillary rise, good drainage, no salt from fertiliser or rain.</li>
          <li>Soil returns to field capacity after each daily drip irrigation (sand, θFC 0.12, FAO-56 Table 19 midpoint).</li>
          <li>Root depth: low end of FAO-56 Table 22 ranges, because drip concentrates roots in the wetted zone.</li>
          <li>Kc values are for full, healthy cover; young or sparse plantings use less.</li>
          <li>Yield response covers salinity only, not water stress or sodium/chloride toxicity (FAO-29 §4).</li>
          <li>The EC pen measures water, so the worker’s photo updates the well EC; soil salinity is modelled between soil tests.</li>
          <li>Pre-dawn start is a design choice (lowest evaporation and wind losses, water in the root zone before peak demand), not an FAO number.</li>
        </ul>
      </Card>

      <Card className="bg-teal-deep text-salt">
        <h2 className="font-display text-xl font-semibold">What it costs the farm</h2>
        <div className="mt-2">
          <Row k={<span className="text-salt/80">EC pen</span>} v="~AED 100, one-off" />
          <Row k={<span className="text-salt/80">App</span>} v="Free · works offline" />
          <Row k={<span className="text-salt/80">Data</span>} v="One sync a week is enough" />
          <Row k={<span className="text-salt/80">Worker</span>} v="Any phone with WhatsApp-style voice notes" />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold">Sources</h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed">
          <li>
            <A href={SRC.fao29}>FAO Irrigation & Drainage Paper 29</A> — Water quality for agriculture (Table 4, eq. 7 & 9, §2.4.2)
          </li>
          <li>
            <A href={SRC.fao56k}>FAO-56 ch. 6</A> — crop coefficients (Tables 11, 12; eq. 62)
          </li>
          <li>
            <A href={SRC.fao56s}>FAO-56 ch. 8</A> — rooting depth & salt tolerance (Tables 22, 23)
          </li>
          <li>
            <A href={SRC.fao61}>FAO Irrigation & Drainage Paper 61, Annex 4</A> — salt storage equations
          </li>
          <li>
            <A href={SRC.om}>Open-Meteo</A> forecast and <A href={SRC.era5}>historical (ERA5)</A> APIs
          </li>
        </ul>
      </Card>
    </div>
  )
}

function Problem({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="font-display text-4xl leading-none font-semibold text-amber-warn">{n}</span>
      <div>
        <h3 className="font-display text-lg font-semibold text-teal-deep">{title}</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-ink/80">{children}</p>
      </div>
    </div>
  )
}
