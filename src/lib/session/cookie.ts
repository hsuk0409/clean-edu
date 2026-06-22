/**
 * 세션 쿠키 헬퍼 — Next.js 전용 얇은 래퍼.
 * 다른 프레임워크로 전환 시 이 파일만 교체하면 됨.
 * jwt.ts의 signSession/verifySession은 그대로 재사용.
 */
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

export const SESSION_COOKIE_NAME = 'clean-edu-session'

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

const MAX_AGE = 60 * 60 * 24 * 7  // 7일

/** 미들웨어(Edge)에서 Request로부터 세션 토큰 읽기 */
export function getTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE_NAME)?.value
}

/** API Route에서 Response에 세션 쿠키 설정 */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE_NAME, token, { ...BASE_OPTIONS, maxAge: MAX_AGE })
}

/** API Route에서 세션 쿠키 삭제 */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, '', { ...BASE_OPTIONS, maxAge: 0 })
}

/** Server Component / Server Action에서 세션 토큰 읽기 */
export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}
