'use client'

import { useEffect } from 'react'

/**
 * Opens the browser's print dialog once the document has been laid out, which
 * is how both a paper print and a "Save as PDF" are produced: the browser owns
 * that decision, not the app. A short delay lets fonts and layout settle so the
 * first page is not blank or half drawn.
 */
export function AutoPrint({ delayMs = 250 }: { delayMs?: number }) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  return null
}
