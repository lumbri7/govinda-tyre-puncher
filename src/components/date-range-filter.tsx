'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Button, cx } from '@/components/ui'
import { addDays, addMonths, startOfMonthISO, todayISO } from '@/lib/dates'

type Preset = { key: string; label: string; from: () => string; to: () => string }

export type SelectFilter = {
  param: string
  label: string
  value: string
  options: { value: string; label: string }[]
}

function buildPresets(): Preset[] {
  const today = todayISO()
  return [
    { key: 'today', label: 'Today', from: () => today, to: () => today },
    { key: 'yesterday', label: 'Yesterday', from: () => addDays(today, -1), to: () => addDays(today, -1) },
    { key: '7d', label: '7 days', from: () => addDays(today, -6), to: () => today },
    { key: '30d', label: '30 days', from: () => addDays(today, -29), to: () => today },
    { key: 'month', label: 'This month', from: () => startOfMonthISO(today), to: () => today },
    {
      key: 'last-month',
      label: 'Last month',
      from: () => startOfMonthISO(addMonths(today, -1)),
      to: () => addDays(startOfMonthISO(today), -1),
    },
  ]
}

/**
 * Filter bar that writes to the URL, so a report is a shareable link and the
 * browser back button steps through previous filters.
 */
export function DateRangeFilter({
  from,
  to,
  selects = [],
  className,
}: {
  from: string
  to: string
  selects?: SelectFilter[]
  className?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presets = buildPresets()
  const [range, setRange] = useState({ from, to })

  const activeKey =
    presets.find((preset) => preset.from() === range.from && preset.to() === range.to)?.key ?? 'custom'

  function push(next: { from: string; to: string }, overrides?: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', next.from)
    params.set('to', next.to)

    for (const select of selects) {
      const value = overrides?.[select.param] ?? select.value
      if (value) params.set(select.param, value)
      else params.delete(select.param)
    }

    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  return (
    <div className={cx('space-y-3', className)}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => {
              const next = { from: preset.from(), to: preset.to() }
              setRange(next)
              push(next)
            }}
            className={cx(
              'min-h-10 shrink-0 rounded-xl px-3 text-sm font-semibold transition-colors',
              activeKey === preset.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {selects.map((select) => (
        <label key={select.param} className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-500">{select.label}</span>
          <select
            value={select.value}
            onChange={(event) => push(range, { [select.param]: event.target.value })}
            className="min-h-12 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-600 focus:outline-none"
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink-500">From</span>
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
            className="min-h-12 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-600 focus:outline-none"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink-500">To</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={todayISO()}
            onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
            className="min-h-12 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-600 focus:outline-none"
          />
        </label>
        <Button size="md" onClick={() => push(range)}>
          Apply
        </Button>
      </div>
    </div>
  )
}