import Link from 'next/link'
import type { Metadata } from 'next'

import { signOut } from '@/app/(auth)/actions'
import { ChangePasswordForm } from '@/app/employee/me/change-password-form'
import { ShopNameForm } from '@/app/owner/settings/shop-name-form'
import { SubmitButton } from '@/components/submit-button'
import { Card, PageTitle, SectionTitle } from '@/components/ui'
import { requireOwner } from '@/lib/auth'

export const metadata: Metadata = { title: 'Settings' }

export default async function OwnerSettingsPage() {
  const session = await requireOwner()

  return (
    <div className="space-y-5">
      <PageTitle title="Shop settings" subtitle={session.businessName} />

      <section className="space-y-2">
        <SectionTitle>Shop</SectionTitle>
        <ShopNameForm name={session.businessName} />
      </section>

      <section className="space-y-2">
        <SectionTitle>Your account</SectionTitle>
        <Card className="space-y-2">
          <p className="text-base font-bold text-ink-950">{session.fullName}</p>
          <p className="text-sm text-ink-600">{session.email ?? 'No email on file'}</p>
          <p className="text-xs text-ink-500">Owner · full access to bills, staff and salary</p>
        </Card>
      </section>

      <section className="space-y-2">
        <SectionTitle>Change password</SectionTitle>
        <Card className="space-y-4">
          <ChangePasswordForm />
        </Card>
      </section>

      <section className="space-y-2">
        <SectionTitle>Session</SectionTitle>
        <div className="space-y-2">
          <form action={signOut}>
            <SubmitButton variant="secondary" pendingLabel="Signing out...">
              Sign out
            </SubmitButton>
          </form>
          <Link
            href="/owner/employees"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 no-underline shadow-sm ring-1 ring-ink-200"
          >
            Manage staff
          </Link>
        </div>
      </section>
    </div>
  )
}
