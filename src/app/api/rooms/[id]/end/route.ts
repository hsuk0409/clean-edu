import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { markRoomEnded } from '@/lib/rooms'

/**
 * POST /api/rooms/[id]/end — 수동 종료 또는 타이머 만료 시 방을 completed로 전이.
 * 학부모는 로그인하지 않으므로 세션 검증 없이 roomId(UUID)만으로 접근 허용.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createAdminClient()
  await markRoomEnded(db, id)
  return NextResponse.json({ ok: true })
}
