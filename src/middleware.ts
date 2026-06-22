import { type NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/session/cookie'
import { verifySession } from '@/lib/session/jwt'

const PROTECTED_PATHS = ['/dashboard', '/rooms']
const AUTH_ONLY_PATHS = ['/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = getTokenFromRequest(request)
  const session = token ? await verifySession(token) : null

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthOnly && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
