import { signOut } from '@/app/(auth)/actions'
import { BrandMark } from '@/components/brand'
import { SubmitButton } from '@/components/submit-button'
import { Card } from '@/components/ui'

export default function NoAccess() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md space-y-4 text-center">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <h1 className="text-xl font-bold text-ink-950">This login is not active</h1>
        <p className="text-sm text-ink-600">
          Your account is signed in but it is not linked to an active shop profile. Ask the shop owner
          to enable your access, then sign in again.
        </p>
        <form action={signOut}>
          <SubmitButton pendingLabel="Signing out...">Sign out and use another login</SubmitButton>
        </form>
      </Card>
    </main>
  )
}