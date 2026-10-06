'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Text search that writes to the URL, so a search can be shared, bookmarked and
 * undone with the back button. It searches on submit rather than on every
 * keystroke: the shop is often on mobile data, and a half typed customer name
 * is not a useful search.
 */
export function SearchField({
  param = 'q',
  label,
  placeholder,
  defaultValue = '',
}: {
  param?: string
  label: string
  placeholder: string
  defaultValue?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)

  function apply(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.trim()) params.set(param, next.trim())
    else params.delete(param)
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        apply(value)
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-semibold text-ink-500">{label}</span>
        <input
          type="search"
          inputMode="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-12 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-600 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="min-h-12 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"
      >
        Search
      </button>
      {defaultValue ? (
        <button
          type="button"
          onClick={() => {
            setValue('')
            apply('')
          }}
          className="min-h-12 shrink-0 rounded-xl bg-white px-3 text-sm font-semibold text-ink-700 shadow-sm ring-1 ring-ink-200"
        >
          Clear
        </button>
      ) : null}
    </form>
  )
}
