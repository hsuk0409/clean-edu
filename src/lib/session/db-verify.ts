/**
 * JWT 서명 검증 이후 DB의 session_version과 대조하는 2단계 검증.
 * Node.js 런타임 전용 (Edge 미들웨어에서 사용 불가).
 *
 * 미들웨어: JWT 서명만 검증 (빠름, Edge 호환)
 * 보호된 레이아웃/페이지: 이 함수로 버전까지 검증 (1회 DB 조회)
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from './types'

/**
 * JWT 페이로드의 sessionVersion이 DB 값과 일치하는지 확인.
 * 불일치 시 null 반환 → 레이아웃에서 /login으로 리다이렉트.
 */
export async function verifySessionVersion(
  session: SessionPayload
): Promise<SessionPayload | null> {
  const db = createAdminClient()

  const { data, error } = await db
    .from('users')
    .select('session_version')
    .eq('id', session.userId)
    .single()

  if (error || data === null) return null
  if (data.session_version !== session.sessionVersion) return null

  return session
}

/**
 * users.session_version을 +1 증가시켜 해당 사용자의 모든 기존 JWT를 무효화.
 * 로그아웃 또는 강제 세션 종료 시 호출.
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  const db = createAdminClient()

  const { data } = await db
    .from('users')
    .select('session_version')
    .eq('id', userId)
    .single()

  if (data) {
    await db
      .from('users')
      .update({ session_version: data.session_version + 1 })
      .eq('id', userId)
  }
}
