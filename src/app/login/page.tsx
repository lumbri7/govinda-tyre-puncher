import Link from 'next/link'

import { BrandMark } from '@/components/brand'
import { LoginForm } from '@/app/login/login-form'
import { Card } from '@/components/ui'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const notice =
    params.reset === '1'
      ? 'Your password has been changed. Please sign in with the new password.'
      : params.reason === 'signed-out'
        ? 'You have been signed out.'
        : params.reason === 'session-ended'
          ? 'Your password has been changed, so this device was signed out. Please sign in again with your new password.'
          : params.reason === 'link-expired'
            ? 'That link has expired. Please request a new one.'
            : undefined

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-14" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-950">Govinda Tyre Puncture</h1>
            <p className="text-sm text-ink-500">Sign in to continue</p>
          </div>
        </div>

        <Card className="space-y-5 p-5">
          <LoginForm notice={notice} />

          <p className="text-center text-xs text-ink-500">
            Setting up the shop for the first time?{' '}
            <Link href="/setup" className="font-semibold text-brand-700 underline">
              Create the owner account
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}