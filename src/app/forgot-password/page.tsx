import type { Metadata } from 'next'
import Link from 'next/link'

import { BrandMark } from '@/components/brand'
import { ForgotPasswordForm } from '@/app/forgot-password/forgot-password-form'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Reset password' }

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12" />
          <h1 className="text-xl font-bold tracking-tight text-ink-950">Reset your password</h1>
        </div>

        <Card className="space-y-5 p-5">
          <ForgotPasswordForm />

          <p className="text-center text-xs text-ink-500">
            <Link href="/login" className="font-semibold text-brand-700 underline">
              Back to sign in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}