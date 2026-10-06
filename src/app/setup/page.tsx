import type { Metadata } from 'next'
import Link from 'next/link'

import { BrandMark } from '@/components/brand'
import { OwnerSetupForm } from '@/app/setup/owner-setup-form'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Set up the shop' }

export default function SetupPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-14" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-950">Set up the shop</h1>
            <p className="text-sm text-ink-500">Create the first owner account</p>
          </div>
        </div>

        <Card className="space-y-5 p-5">
          <p className="rounded-xl bg-cash-50 px-3 py-2.5 text-sm text-cash-700">
            This page works only once, for the very first owner. If the shop is already set up it
            will refuse to create a second account.
          </p>

          <OwnerSetupForm />

          <p className="text-center text-xs text-ink-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-brand-700 underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}