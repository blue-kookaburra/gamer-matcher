'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Signs the user out when they reopen the browser if they logged in without "Remember me".
// Logic:
//   - On login without remember-me: localStorage.no_persist='1' + sessionStorage.session_active='1'
//   - On login with remember-me: localStorage.no_persist is removed
//   - On mount here: if no_persist='1' but session_active is gone (new browser session), sign out.
// NOTE: skips auth pages to avoid an infinite redirect loop if no_persist is stale.
export default function SessionGuard() {
  const pathname = usePathname()

  useEffect(() => {
    // Never run on auth pages — would cause an infinite reload loop
    if (pathname.startsWith('/auth')) return

    const noPersist = localStorage.getItem('no_persist')
    const sessionActive = sessionStorage.getItem('session_active')

    if (noPersist === '1' && !sessionActive) {
      const supabase = createClient()
      supabase.auth.signOut().then(() => {
        window.location.href = '/auth/login'
      })
    }
  }, [pathname])

  return null
}
