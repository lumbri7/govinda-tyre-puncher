'use client'

/**
 * Builds the CSV in the browser, so the numbers exported are exactly the
 * numbers on screen and no server route is needed.
 */
export function DownloadCsv({
  filename,
  rows,
  label = 'Download CSV',
}: {
  filename: string
  rows: (string | number)[][]
  label?: string
}) {
  function download() {
    const csv = rows
      .map((row) => row.map((cell) => escapeCell(String(cell))).join(','))
      .join('\r\n')

    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  )
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
