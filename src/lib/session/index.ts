/**
 * 세션 모듈 barrel export
 *
 * | 목적                           | import                                            |
 * |--------------------------------|---------------------------------------------------|
 * | JWT 서명/검증 (프레임워크 무관) | @/lib/session/jwt → signSession, verifySession    |
 * | DB 버전 검증 (Node.js 전용)     | @/lib/session/db-verify → verifySessionVersion    |
 * | 현재 세션 완전 검증 (서버 전용) | @/lib/session/current → getVerifiedSession        |
 * | 강제 세션 무효화                | @/lib/session/db-verify → invalidateAllSessions   |
 * | Next.js 쿠키 헬퍼               | @/lib/session/cookie → setSessionCookie 등        |
 */
export type { SessionPayload } from './types'
export { signSession, verifySession } from './jwt'
export { verifySessionVersion, invalidateAllSessions } from './db-verify'
export { getVerifiedSession } from './current'
export {
  SESSION_COOKIE_NAME,
  getTokenFromRequest,
  setSessionCookie,
  clearSessionCookie,
  getTokenFromCookies,
} from './cookie'
