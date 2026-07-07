import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { markRoomStarted } from '@/lib/rooms'

/**
 * POST /api/rooms/[id]/start — 통화 연결 성공 시 방을 active로 전이.
 * 학부모는 로그인하지 않으므로 세션 검증 없이 roomId(UUID)만으로 접근 허용.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createAdminClient()
  await markRoomStarted(db, id)
  return NextResponse.json({ ok: true })
}
