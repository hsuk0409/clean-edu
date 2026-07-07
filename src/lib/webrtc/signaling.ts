/**
 * WebRTC 시그널링 레이어 — Supabase Realtime을 통해 SDP/ICE 메시지를 중개.
 * 브라우저 전용 (Supabase 클라이언트를 주입받아 동작).
 *
 * Realtime 구독은 "구독 이후에 발생한" INSERT만 전달하므로, 상대방이 이미
 * 보낸 메시지(예: 교사가 먼저 만든 offer)를 놓칠 수 있음.
 * → fetchBacklogSignals로 과거 메시지를 먼저 가져오고, 구독 중 들어온 메시지는
 *   backlog 처리가 끝날 때까지 큐잉했다가 id로 중복 제거 후 처리해야 함(호출부 책임).
 */
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { CallRole, SignalPayload } from './types'

type DbClient = SupabaseClient<Database>
type SignalRow = Database['public']['Tables']['signaling_messages']['Row']

/** 상대방에게 시그널(offer/answer/ice-candidate)을 전송 */
export async function sendSignal(
  db: DbClient,
  roomId: string,
  senderRole: CallRole,
  signal: SignalPayload
): Promise<void> {
  // RTCIceCandidateInit/RTCSessionDescriptionInit는 인덱스 시그니처가 없어 Json과
  // 구조적으로 호환되지 않으므로, 순수 JSON 데이터임을 명시적으로 캐스팅한다.
  const payload = (
    signal.type === 'ice-candidate' ? { candidate: signal.candidate } : { sdp: signal.sdp }
  ) as unknown as Json

  const { error } = await db.from('signaling_messages').insert({
    room_id: roomId,
    sender_role: senderRole,
    type: signal.type,
    payload,
  })

  if (error) {
    throw new Error(`Failed to send signal: ${error.message}`)
  }
}

function rowToSignal(row: SignalRow): SignalPayload {
  const raw = row.payload as Record<string, unknown>
  if (row.type === 'ice-candidate') {
    return { type: 'ice-candidate', candidate: raw.candidate as RTCIceCandidateInit }
  }
  return { type: row.type, sdp: raw.sdp as RTCSessionDescriptionInit }
}

/** 상대방(자신의 role이 아닌 쪽)이 이미 보낸 과거 시그널을 시간순으로 조회 */
export async function fetchBacklogSignals(
  db: DbClient,
  roomId: string,
  selfRole: CallRole
): Promise<Array<{ id: string; signal: SignalPayload }>> {
  const { data, error } = await db
    .from('signaling_messages')
    .select()
    .eq('room_id', roomId)
    .neq('sender_role', selfRole)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch signaling backlog: ${error.message}`)
  }

  return (data ?? []).map((row) => ({ id: row.id, signal: rowToSignal(row) }))
}

/**
 * 상대방이 보낸 신규 시그널을 실시간 구독.
 * 반환된 함수를 호출하면 구독 해제.
 */
export function subscribeToSignals(
  db: DbClient,
  roomId: string,
  selfRole: CallRole,
  onSignal: (id: string, signal: SignalPayload) => void
): () => void {
  const channel: RealtimeChannel = db
    .channel(`room:${roomId}:signaling`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'signaling_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const row = payload.new as SignalRow
        if (row.sender_role === selfRole) return // 자기 자신이 보낸 메시지는 무시
        onSignal(row.id, rowToSignal(row))
      }
    )
    .subscribe()

  return () => {
    db.removeChannel(channel)
  }
}
