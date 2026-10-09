'use client'

/** Re-runs the current page: the honest "try again" for a failed load. */
export function ReloadButton({ label = 'Try again' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-3 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200 transition-colors hover:bg-ink-50"
    >
      {label}
    </button>
  )
}