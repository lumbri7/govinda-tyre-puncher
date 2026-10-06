import type { Metadata } from 'next'

import { BrandMark } from '@/components/brand'
import { UpdatePasswordForm } from '@/app/update-password/update-password-form'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Choose a new password' }

export default function UpdatePasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12" />
          <h1 className="text-xl font-bold tracking-tight text-ink-950">Choose a new password</h1>
        </div>

        <Card className="space-y-5 p-5">
          <UpdatePasswordForm />
        </Card>
      </div>
    </main>
  )
}