import { NextResponse } from 'next/server'
import { getTokenFromCookies } from '@/lib/session/cookie'
import { verifySession } from '@/lib/session/jwt'
import { verifySessionVersion } from '@/lib/session/db-verify'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRoom } from '@/lib/rooms'

/** POST /api/rooms — 교사가 새 상담방을 생성 */
export async function POST() {
  const token = await getTokenFromCookies()
  const jwtSession = token ? await verifySession(token) : null
  const session = jwtSession ? await verifySessionVersion(jwtSession) : null

  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const db = createAdminClient()
  const room = await createRoom(db, session.userId)

  return NextResponse.json({ room })
}
