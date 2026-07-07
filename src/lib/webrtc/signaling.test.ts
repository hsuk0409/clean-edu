import { describe, it, expect, vi } from 'vitest'
import { sendSignal, fetchBacklogSignals, subscribeToSignals } from './signaling'
import { createMockDb } from '@/test/mock-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const SDP: RTCSessionDescriptionInit = { type: 'offer', sdp: 'v=0...' }
const CANDIDATE: RTCIceCandidateInit = { candidate: 'candidate:1 ...', sdpMid: '0' }

describe('sendSignal', () => {
  it('offer/answer는 payload를 { sdp }로 감싸 insert한다', async () => {
    const { db, lastArgs } = createMockDb({ data: null, error: null })

    await sendSignal(db, 'room-1', 'teacher', { type: 'offer', sdp: SDP })

    expect(lastArgs('insert')?.[0]).toEqual({
      room_id: 'room-1',
      sender_role: 'teacher',
      type: 'offer',
      payload: { sdp: SDP },
    })
  })

  it('ice-candidate는 payload를 { candidate }로 감싸 insert한다', async () => {
    const { db, lastArgs } = createMockDb({ data: null, error: null })

    await sendSignal(db, 'room-1', 'parent', { type: 'ice-candidate', candidate: CANDIDATE })

    expect(lastArgs('insert')?.[0]).toEqual({
      room_id: 'room-1',
      sender_role: 'parent',
      type: 'ice-candidate',
      payload: { candidate: CANDIDATE },
    })
  })

  it('hangup은 payload를 빈 객체로 insert한다', async () => {
    const { db, lastArgs } = createMockDb({ data: null, error: null })

    await sendSignal(db, 'room-1', 'teacher', { type: 'hangup' })

    expect(lastArgs('insert')?.[0]).toEqual({
      room_id: 'room-1',
      sender_role: 'teacher',
      type: 'hangup',
      payload: {},
    })
  })

  it('insert 실패 시 에러를 throw한다', async () => {
    const { db } = createMockDb({ data: null, error: { message: 'boom' } })

    await expect(sendSignal(db, 'room-1', 'teacher', { type: 'offer', sdp: SDP })).rejects.toThrow(
      /Failed to send signal: boom/
    )
  })
})

describe('fetchBacklogSignals', () => {
  it('상대 role만 시간순으로 조회하도록 쿼리를 구성한다', async () => {
    const { db, calls } = createMockDb({ data: [], error: null })

    await fetchBacklogSignals(db, 'room-9', 'teacher')

    const methods = calls.map((c) => c.method)
    expect(methods).toContain('eq')
    expect(methods).toContain('neq')
    expect(methods).toContain('order')
    // 자신(teacher)이 아닌 메시지만 → neq('sender_role', 'teacher')
    const neq = calls.find((c) => c.method === 'neq')
    expect(neq?.args).toEqual(['sender_role', 'teacher'])
  })

  it('DB row를 SignalPayload로 변환한다 (offer / ice-candidate / hangup)', async () => {
    const rows = [
      { id: 'a', type: 'offer', payload: { sdp: SDP } },
      { id: 'b', type: 'ice-candidate', payload: { candidate: CANDIDATE } },
      { id: 'c', type: 'hangup', payload: {} },
    ]
    const { db } = createMockDb({ data: rows, error: null })

    const result = await fetchBacklogSignals(db, 'room-1', 'parent')

    expect(result).toEqual([
      { id: 'a', signal: { type: 'offer', sdp: SDP } },
      { id: 'b', signal: { type: 'ice-candidate', candidate: CANDIDATE } },
      { id: 'c', signal: { type: 'hangup' } },
    ])
  })

  it('data가 null이면 빈 배열을 반환한다', async () => {
    const { db } = createMockDb({ data: null, error: null })
    expect(await fetchBacklogSignals(db, 'room-1', 'parent')).toEqual([])
  })

  it('조회 실패 시 에러를 throw한다', async () => {
    const { db } = createMockDb({ data: null, error: { message: 'nope' } })
    await expect(fetchBacklogSignals(db, 'room-1', 'parent')).rejects.toThrow(
      /Failed to fetch signaling backlog: nope/
    )
  })
})

describe('subscribeToSignals', () => {
  /** channel().on().subscribe() 체인을 흉내내고 등록된 콜백을 캡처하는 목 */
  function createChannelMock() {
    let handler: ((payload: { new: unknown }) => void) | undefined
    const channel = {
      on: vi.fn((_event: string, _filter: unknown, cb: (p: { new: unknown }) => void) => {
        handler = cb
        return channel
      }),
      subscribe: vi.fn(() => channel),
    }
    const removeChannel = vi.fn()
    const db = {
      channel: vi.fn(() => channel),
      removeChannel,
    } as unknown as SupabaseClient<Database>
    return { db, removeChannel, emit: (row: unknown) => handler?.({ new: row }) }
  }

  it('자신이 보낸 메시지(sender_role === selfRole)는 무시한다', () => {
    const { db, emit } = createChannelMock()
    const onSignal = vi.fn()

    subscribeToSignals(db, 'room-1', 'teacher', onSignal)
    emit({ id: 'x', sender_role: 'teacher', type: 'offer', payload: { sdp: SDP } })

    expect(onSignal).not.toHaveBeenCalled()
  })

  it('상대가 보낸 메시지는 변환하여 onSignal로 전달한다', () => {
    const { db, emit } = createChannelMock()
    const onSignal = vi.fn()

    subscribeToSignals(db, 'room-1', 'teacher', onSignal)
    emit({ id: 'y', sender_role: 'parent', type: 'answer', payload: { sdp: SDP } })

    expect(onSignal).toHaveBeenCalledWith('y', { type: 'answer', sdp: SDP })
  })

  it('반환된 함수를 호출하면 채널을 해제한다', () => {
    const { db, removeChannel } = createChannelMock()
    const unsubscribe = subscribeToSignals(db, 'room-1', 'teacher', vi.fn())

    unsubscribe()
    expect(removeChannel).toHaveBeenCalledTimes(1)
  })
})
