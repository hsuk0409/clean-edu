/**
 * 현재 요청의 세션을 완전 검증하여 반환하는 서버 전용 헬퍼.
 * (쿠키 → JWT 서명 검증 → DB session_version 대조) 3단계를 한 번에 수행.
 *
 * Server Component / Server Action / API Route에서 사용.
 * 미들웨어(Edge)에서는 DB 조회가 불가하므로 사용 불가 — verifySession만 사용할 것.
 */
import { getTokenFromCookies } from './cookie'
import { verifySession } from './jwt'
import { verifySessionVersion } from './db-verify'
import type { SessionPayload } from './types'

/**
 * 검증에 성공하면 SessionPayload, 실패(비로그인/만료/무효화)하면 null.
 * 호출부에서 null 처리(리다이렉트 또는 401)를 담당한다.
 */
export async function getVerifiedSession(): Promise<SessionPayload | null> {
  const token = await getTokenFromCookies()
  const jwtSession = token ? await verifySession(token) : null
  return jwtSession ? await verifySessionVersion(jwtSession) : null
}
