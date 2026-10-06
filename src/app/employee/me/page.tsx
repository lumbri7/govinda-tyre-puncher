import type { Metadata } from 'next'
import Link from 'next/link'

import { signOut } from '@/app/(auth)/actions'

import { ChangePasswordForm } from '@/app/employee/me/change-password-form'
import { SubmitButton } from '@/components/submit-button'
import { Card, PageTitle, SectionTitle } from '@/components/ui'
import { requireEmployee } from '@/lib/auth'

export const metadata: Metadata = { title: 'My account' }

export default async function MePage() {
  const session = await requireEmployee()

  return (
    <div className="space-y-5">
      <PageTitle title="Me" subtitle={session.businessName} />

      <Card className="space-y-1.5">
        <p className="text-base font-bold text-ink-950">{session.fullName}</p>
        <p className="tabular text-sm text-ink-600">{session.phone ?? 'No mobile number on file'}</p>
        <p className="text-xs text-ink-500">
          Role: employee · part of the shop records
        </p>
      </Card>

      <section>
        <SectionTitle>Change password</SectionTitle>
        <Card className="space-y-4">
          <ChangePasswordForm />
        </Card>
      </section>

      <section>
        <SectionTitle>Session</SectionTitle>
        <div className="space-y-2">
          <form action={signOut}>
            <SubmitButton variant="secondary" pendingLabel="Signing out...">
              Sign out
            </SubmitButton>
          </form>
          <Link
            href="/employee/alerts"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 no-underline shadow-sm ring-1 ring-ink-200"
          >
            View alerts
          </Link>
        </div>
      </section>
    </div>
  )
}