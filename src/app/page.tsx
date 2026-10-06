import { redirect } from 'next/navigation'

import { getAuthUser, homeFor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  // Roles only ever come from Postgres, never from the URL or a cookie.
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_active) redirect('/no-access')

  redirect(homeFor(profile.role))
}