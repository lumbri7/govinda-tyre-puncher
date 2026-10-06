import Link from 'next/link'

import { BrandMark } from '@/components/brand'
import { Card } from '@/components/ui'

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md space-y-4 text-center">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <h1 className="text-xl font-bold text-ink-950">Page not found</h1>
        <p className="text-sm text-ink-600">
          That link does not lead anywhere. It may belong to a bill that was created on another
          device.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white no-underline"
        >
          Go to home
        </Link>
      </Card>
    </main>
  )
}
