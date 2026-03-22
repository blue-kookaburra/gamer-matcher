import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client — use this in Client Components and for real-time subscriptions
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
