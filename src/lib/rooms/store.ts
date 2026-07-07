/**
 * WebRTC 상담방(rooms) 영속화 레이어.
 * SupabaseClient를 주입받아 동작 → DB 어댑터 교체 시 이 파일만 수정.
 * Next.js 의존성 없음.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Room } from './types'

type DbClient = SupabaseClient<Database>

/** 교사가 새 상담방을 생성 (invite_token은 DB 디폴트로 자동 발급) */
export async function createRoom(
  db: DbClient,
  teacherId: string,
  options?: { durationLimit?: number; scheduledAt?: Date }
): Promise<Room> {
  const { data, error } = await db
    .from('rooms')
    .insert({
      teacher_id: teacherId,
      duration_limit: options?.durationLimit ?? 15,
      scheduled_at: options?.scheduledAt?.toISOString() ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create room: ${error?.message}`)
  }

  return data
}

/** 방 ID로 조회 (교사용 — RLS로 본인 소유만 접근 가능) */
export async function getRoomById(db: DbClient, roomId: string): Promise<Room | null> {
  const { data, error } = await db.from('rooms').select().eq('id', roomId).maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch room: ${error.message}`)
  }

  return data
}

/** invite_token으로 조회 (학부모용 — 공개 조회 RLS 정책 적용) */
export async function getRoomByInviteToken(
  db: DbClient,
  inviteToken: string
): Promise<Room | null> {
  const { data, error } = await db
    .from('rooms')
    .select()
    .eq('invite_token', inviteToken)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch room: ${error.message}`)
  }

  return data
}

/** 양쪽 참여자가 모두 입장했을 때 방을 active 상태로 전이 */
export async function markRoomStarted(db: DbClient, roomId: string): Promise<void> {
  const { error } = await db
    .from('rooms')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('status', 'pending')

  if (error) {
    throw new Error(`Failed to start room: ${error.message}`)
  }
}

/** 통화 종료(타이머 만료 또는 수동 종료) 시 방을 completed 상태로 전이 */
export async function markRoomEnded(db: DbClient, roomId: string): Promise<void> {
  const { error } = await db
    .from('rooms')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', roomId)
    .in('status', ['pending', 'active'])

  if (error) {
    throw new Error(`Failed to end room: ${error.message}`)
  }
}
