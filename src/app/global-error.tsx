'use client'

/**
 * Catches errors that escape every page and layout boundary: the last line of
 * defence so a production outage shows a calm screen instead of a blank white
 * page or a stack trace. It must own an <html> tag, because it replaces the
 * whole document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-ink-50">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-bold text-ink-950">Something went wrong</h1>
          <p className="max-w-sm text-sm text-ink-600">
            The screen could not be finished. Your data is safe — try again, and if it keeps
            happening, try again in a minute.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Try again
          </button>
          {process.env.NODE_ENV !== 'production' ? (
            <p className="max-w-sm text-xs text-ink-400">{error.message}</p>
          ) : null}
        </main>
      </body>
    </html>
  )
}