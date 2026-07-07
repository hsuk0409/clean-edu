import { NextResponse } from 'next/server'
import { getVerifiedSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRoom } from '@/lib/rooms'

/** POST /api/rooms — 교사가 새 상담방을 생성 */
export async function POST() {
  const session = await getVerifiedSession()

  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const db = createAdminClient()
  const room = await createRoom(db, session.userId)

  return NextResponse.json({ room })
}
