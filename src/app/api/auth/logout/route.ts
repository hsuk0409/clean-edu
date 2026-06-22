import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, clearSessionCookie } from '@/lib/session/cookie'
import { verifySession } from '@/lib/session/jwt'
import { invalidateAllSessions } from '@/lib/session/db-verify'

/** POST /api/auth/logout — session_version +1 후 세션 쿠키 삭제 */
export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request)
  const session = token ? await verifySession(token) : null

  // 세션이 유효한 경우에만 DB의 session_version 증가 (모든 기기 로그아웃)
  if (session) {
    await invalidateAllSessions(session.userId)
  }

  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL!)
  )
  clearSessionCookie(response)
  return response
}
