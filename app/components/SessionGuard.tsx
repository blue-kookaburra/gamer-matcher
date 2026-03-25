'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Signs the user out when they reopen the browser if they logged in without "Remember me".
// Logic:
//   - On login without remember-me: localStorage.no_persist='1' + sessionStorage.session_active='1'
//   - On login with remember-me: localStorage.no_persist is removed
//   - On mount here: if no_persist='1' but session_active is gone (new browser session), sign out.
export default function SessionGuard() {
  useEffect(() => {
    const noPersist = localStorage.getItem('no_persist')
    const sessionActive = sessionStorage.getItem('session_active')

    if (noPersist === '1' && !sessionActive) {
      const supabase = createClient()
      supabase.auth.signOut().then(() => {
        window.location.href = '/auth/login'
      })
    }
  }, [])

  return null
}
