export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-sand-700">Namak · نمک · नमक</p>
      <h1 className="font-display text-5xl leading-[1.05] text-teal-deep">
        Your well is salty.
        <br />
        <span className="text-red-debt">Your soil is keeping score.</span>
      </h1>
      <p className="text-lg leading-relaxed text-ink/80">
        Every litre of brackish water leaves salt behind. Namak tracks that <strong>salt debt</strong>, plans how much
        water each valve needs tomorrow, and sends the exact minutes to the farm worker as a voice note in their own
        language.
      </p>
      <p className="rounded-2xl border border-sand-300 bg-salt px-4 py-3 text-sm text-sand-700">
        Prototype in progress · Breaking Bytes A-001 · the live demo farm arrives later today.
      </p>
    </main>
  )
}
