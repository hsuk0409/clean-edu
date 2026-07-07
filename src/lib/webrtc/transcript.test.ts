import { describe, it, expect, vi } from 'vitest'
import { sendTranscript, subscribeToTranscripts } from './transcript'
import { createMockDb } from '@/test/mock-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

describe('sendTranscript', () => {
  it('room_id/speaker_role/text를 insert한다', async () => {
    const { db, lastArgs } = createMockDb({ data: null, error: null })

    await sendTranscript(db, 'room-1', 'parent', '환불해주세요')

    expect(lastArgs('insert')?.[0]).toEqual({
      room_id: 'room-1',
      speaker_role: 'parent',
      text: '환불해주세요',
    })
  })

  it('insert 실패 시 에러를 throw한다', async () => {
    const { db } = createMockDb({ data: null, error: { message: 'boom' } })

    await expect(sendTranscript(db, 'room-1', 'teacher', 'hi')).rejects.toThrow(
      /Failed to send transcript: boom/
    )
  })
})

describe('subscribeToTranscripts', () => {
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

  it('신규 전사(자신 포함)를 그대로 전달한다', () => {
    const { db, emit } = createChannelMock()
    const onTranscript = vi.fn()

    subscribeToTranscripts(db, 'room-1', onTranscript)
    emit({ id: 'a', room_id: 'room-1', speaker_role: 'parent', text: '환불해주세요' })

    expect(onTranscript).toHaveBeenCalledWith({ speakerRole: 'parent', text: '환불해주세요' })
  })

  it('반환된 함수를 호출하면 채널을 해제한다', () => {
    const { db, removeChannel } = createChannelMock()
    const unsubscribe = subscribeToTranscripts(db, 'room-1', vi.fn())

    unsubscribe()
    expect(removeChannel).toHaveBeenCalledTimes(1)
  })
})
