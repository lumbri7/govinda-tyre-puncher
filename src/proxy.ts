import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - api routes
     * - _next/static and _next/image (build output)
     * - the service worker and offline page
     * - public files with an extension (icons, manifest, robots.txt)
     */
    '/((?!api|_next/static|_next/image|sw\\.js|offline|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}