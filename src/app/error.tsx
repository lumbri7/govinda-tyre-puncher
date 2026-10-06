'use client'

import { useEffect } from 'react'

import { BrandMark } from '@/components/brand'
import { Card } from '@/components/ui'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Replace with your error reporter (Sentry, etc.) before going live.
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md space-y-4 text-center">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <h1 className="text-xl font-bold text-ink-950">Something went wrong</h1>
        <p className="text-sm text-ink-600">
          The page could not be shown. Nothing was saved. Please try again.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-ink-400">Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </Card>
    </main>
  )
}
