'use client'

import { useState } from 'react'

type BillActionsProps = {
  /** Absolute-safe path of the standalone print document. */
  printHref: string
  /** Professional short summary, built on the server. */
  summary: string
  /** `https://wa.me/...` with the message prefilled, or null when we have no customer number. */
  whatsappUrl: string | null
}

/**
 * Everything you can do *with* a bill, deliberately outside the document so the
 * receipt and PDF stay clean.
 *
 * Printing goes through a dedicated document route instead of printing this
 * screen, because the app shell must never end up on paper. Sharing uses the
 * phone's own share sheet; when the browser cannot share, the bill link is
 * copied instead and the person is told so.
 */
export function BillActions({ printHref, summary, whatsappUrl }: BillActionsProps) {
  const [notice, setNotice] = useState<string | null>(null)

  function say(message: string) {
    setNotice(message)
  }

  async function share() {
    const url = window.location.href
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean
      share?: (data: ShareData) => Promise<void>
    }

    if (typeof nav.share !== 'function') {
      await copy(url)
      return
    }

    try {
      await nav.share({ title: 'Bill', text: summary, url })
    } catch (error) {
      // A cancelled share sheet is not a failure the person needs to hear about.
      if (error instanceof DOMException && error.name === 'AbortError') return
      await copy(url)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      say('Bill link copied.')
    } catch {
      say('Could not copy automatically. Copy the link from the address bar.')
    }
  }

  return (
    <div className="no-print space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a
          href={printHref}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white no-underline shadow-sm hover:bg-brand-700"
        >
          <PrintIcon />
          Print
        </a>
        <a
          href={printHref}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 no-underline shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
        >
          <DownloadIcon />
          Save as PDF
        </a>
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
        >
          <ShareIcon />
          Share
        </button>
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-good-600 px-4 text-sm font-semibold text-white no-underline shadow-sm hover:bg-good-700"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
        ) : null}
      </div>

      <p className="min-h-4 px-1 text-center text-xs text-ink-500" aria-live="polite">
        {notice ?? 'Sharing opens WhatsApp or your share sheet. You decide when to send.'}
      </p>
    </div>
  )
}

function PrintIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M7 9V4h10v5M7 18H5a1 1 0 01-1-1v-5a1 1 0 012-2h12a2 2 0 012 2v5a1 1 0 01-1 1h-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 14h10v6H7z" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 4v11m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.3m-7.6 6.7l7.6 4.3" strokeLinecap="round" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.6 4.7-1.3A10 10 0 1012 2zm5.1 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.2-.8-2.7-1.1-4.4-4-4.5-4.1-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.2c.1.2.1.4 0 .6l-.4.5c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 2 1.3 2.3 1.4.3.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l2.1 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" />
    </svg>
  )
}
