'use client'

import { useState } from 'react'

import { setEmployeeActive } from '@/app/owner/actions'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui'

/**
 * "Disable this employee" is final in the moment it lands: the employee is
 * signed out of every device and their access stops at once, so the owner
 * should never reach it by accident. The disabling side of the form is hidden
 * behind a confirmation that spells out what happens. Enabling is not
 * destructive and stays a single tap.
 */
export function EmployeeActiveForm({
  employeeId,
  employeeName,
  isActive,
}: {
  employeeId: string
  employeeName: string
  isActive: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  if (isActive && !confirming) {
    return (
      <div className="space-y-2">
        <Button variant="danger" size="md" full onClick={() => setConfirming(true)}>
          Disable this employee
        </Button>
        <p className="text-xs text-ink-500">
          Disabling signs the employee out on every device and blocks their bills and salary
          immediately. Their past bills and salary records stay exactly as they are.
        </p>
      </div>
    )
  }

  return (
    <form action={setEmployeeActive}>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="isActive" value={isActive ? 'false' : 'true'} />

      {isActive ? (
        <div className="space-y-3 rounded-xl border border-bad-200 bg-bad-50 p-3">
          <p className="text-sm font-bold text-bad-700">
            Disable {employeeName}?
          </p>
          <p className="text-xs text-ink-700">
            They are signed out of every device right away and can no longer create bills, see
            salary or accept payments. Nothing they did before is deleted. You can enable them again
            at any time.
          </p>
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="md" pendingLabel="Disabling...">
              Yes, disable this employee
            </SubmitButton>
            <Button size="md" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <SubmitButton variant="secondary" size="md" pendingLabel="Enabling...">
          Enable this employee
        </SubmitButton>
      )}
    </form>
  )
}