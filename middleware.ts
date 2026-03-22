import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Protects host-only routes — redirects unauthenticated users to login
// /join routes are intentionally public (guests don't have accounts)
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for @supabase/ssr to keep session alive
  const { data: { user } } = await supabase.auth.getUser()

  const protectedPaths = ['/dashboard', '/sessions', '/bgg']
  // Guests (no account) need access to vote and results pages
  const publicSessionPaths = ['/vote', '/results']
  const isPublicSession = publicSessionPaths.some(suffix =>
    request.nextUrl.pathname.endsWith(suffix)
  )
  const isProtected = !isPublicSession && protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/sessions/:path*', '/bgg/:path*'],
}
