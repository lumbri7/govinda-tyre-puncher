'use client'

import { useEffect } from 'react'

/** Must match DRAFT_STORAGE_KEY in the billing wizard. */
const DRAFT_STORAGE_KEY = 'govinda.bill-draft.v1'

/**
 * A saved bill is its own record: the moment its page loads, the in-progress
 * draft on this device is done and must not resurface on the next bill,
 * carrying the previous customer's details into it.
 */
export function ClearBillDraft() {
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      // A blocked storage must not break the bill page.
    }
  }, [])
  return null
}