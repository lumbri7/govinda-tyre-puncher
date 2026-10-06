import type { Metadata } from 'next'
import Link from 'next/link'

import { submitBill } from '@/app/employee/bill/new/actions'
import { BillWizard } from '@/components/billing/bill-wizard'
import { IconBack } from '@/components/icons'

export const metadata: Metadata = { title: 'New Bill' }

export default function NewBillPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/employee"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 no-underline"
      >
        <IconBack className="size-4" /> Home
      </Link>

      <BillWizard submitAction={submitBill} />
    </div>
  )
}