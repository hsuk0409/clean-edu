/**
 * 실시간 STT 전사 중계 레이어 — signaling.ts와 동일하게 Supabase Realtime을 통해
 * 각자 인식한 발화 텍스트를 상대방에게 중계한다 (원격 오디오는 직접 STT할 수 없으므로,
 * 각 클라이언트가 자신의 마이크 입력을 인식해 전송하는 구조).
 *
 * signaling과 달리 반복 감지는 "통화 중 실시간"에만 의미가 있으므로 backlog 조회는
 * 제공하지 않는다 — 통화 종료 후 전체 로그가 필요한 M5(AI 요약)는 call_transcripts
 * 테이블을 room_id로 직접 조회하면 된다.
 */
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { CallRole } from './types'

type DbClient = SupabaseClient<Database>
type TranscriptRow = Database['public']['Tables']['call_transcripts']['Row']

export interface TranscriptEntry {
  speakerRole: CallRole
  text: string
}

/** 자신이 인식한 발화 텍스트를 상대방에게 전송 */
export async function sendTranscript(
  db: DbClient,
  roomId: string,
  speakerRole: CallRole,
  text: string
): Promise<void> {
  const { error } = await db.from('call_transcripts').insert({
    room_id: roomId,
    speaker_role: speakerRole,
    text,
  })

  if (error) {
    throw new Error(`Failed to send transcript: ${error.message}`)
  }
}

/**
 * 신규 전사 텍스트를 실시간 구독 (자신이 보낸 것 포함, 모든 발화자).
 * 반환된 함수를 호출하면 구독 해제.
 */
export function subscribeToTranscripts(
  db: DbClient,
  roomId: string,
  onTranscript: (entry: TranscriptEntry) => void
): () => void {
  const channel: RealtimeChannel = db
    .channel(`room:${roomId}:transcripts`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_transcripts',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const row = payload.new as TranscriptRow
        onTranscript({ speakerRole: row.speaker_role, text: row.text })
      }
    )
    .subscribe()

  return () => {
    db.removeChannel(channel)
  }
}
