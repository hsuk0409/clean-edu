import { describe, it, expect } from 'vitest'
import {
  createRoom,
  getRoomById,
  getRoomByInviteToken,
  markRoomStarted,
  markRoomEnded,
} from './store'
import { createMockDb } from '@/test/mock-supabase'

const ROOM = {
  id: 'room-1',
  teacher_id: 'teacher-1',
  invite_token: 'tok',
  duration_limit: 15,
  status: 'pending',
}

describe('createRoom', () => {
  it('duration_limit 기본값 15로 insert하고 생성된 row를 반환한다', async () => {
    const { db, lastArgs } = createMockDb({ data: ROOM, error: null })

    const room = await createRoom(db, 'teacher-1')

    const inserted = lastArgs('insert')?.[0] as Record<string, unknown>
    expect(inserted.teacher_id).toBe('teacher-1')
    expect(inserted.duration_limit).toBe(15)
    expect(inserted.scheduled_at).toBeNull()
    expect(room).toEqual(ROOM)
  })

  it('options로 duration/scheduledAt을 넘기면 반영한다', async () => {
    const { db, lastArgs } = createMockDb({ data: ROOM, error: null })
    const when = new Date('2026-07-07T10:00:00.000Z')

    await createRoom(db, 'teacher-1', { durationLimit: 30, scheduledAt: when })

    const inserted = lastArgs('insert')?.[0] as Record<string, unknown>
    expect(inserted.duration_limit).toBe(30)
    expect(inserted.scheduled_at).toBe(when.toISOString())
  })

  it('실패 시 에러를 throw한다', async () => {
    const { db } = createMockDb({ data: null, error: { message: 'insert failed' } })
    await expect(createRoom(db, 'teacher-1')).rejects.toThrow(/Failed to create room: insert failed/)
  })
})

describe('getRoomById / getRoomByInviteToken', () => {
  it('id로 조회하여 row를 반환한다', async () => {
    const { db, lastArgs } = createMockDb({ data: ROOM, error: null })
    const room = await getRoomById(db, 'room-1')
    expect(lastArgs('eq')).toEqual(['id', 'room-1'])
    expect(room).toEqual(ROOM)
  })

  it('invite_token으로 조회하여 row를 반환한다', async () => {
    const { db, lastArgs } = createMockDb({ data: ROOM, error: null })
    const room = await getRoomByInviteToken(db, 'tok')
    expect(lastArgs('eq')).toEqual(['invite_token', 'tok'])
    expect(room).toEqual(ROOM)
  })

  it('없는 방은 null을 반환한다', async () => {
    const { db } = createMockDb({ data: null, error: null })
    expect(await getRoomById(db, 'nope')).toBeNull()
  })

  it('조회 실패 시 에러를 throw한다', async () => {
    const { db } = createMockDb({ data: null, error: { message: 'db down' } })
    await expect(getRoomById(db, 'room-1')).rejects.toThrow(/Failed to fetch room: db down/)
  })
})

describe('markRoomStarted', () => {
  it('pending 상태의 방만 active로 전이한다', async () => {
    const { db, calls, lastArgs } = createMockDb({ data: null, error: null })

    await markRoomStarted(db, 'room-1')

    const update = lastArgs('update')?.[0] as Record<string, unknown>
    expect(update.status).toBe('active')
    expect(typeof update.started_at).toBe('string')
    // 조건부 전이: .eq('id', ...).eq('status', 'pending')
    const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqCalls).toContainEqual(['id', 'room-1'])
    expect(eqCalls).toContainEqual(['status', 'pending'])
  })

  it('실패 시 에러를 throw한다', async () => {
    const { db } = createMockDb({ data: null, error: { message: 'x' } })
    await expect(markRoomStarted(db, 'room-1')).rejects.toThrow(/Failed to start room: x/)
  })
})

describe('markRoomEnded', () => {
  it('pending/active 상태의 방을 completed로 전이한다', async () => {
    const { db, calls, lastArgs } = createMockDb({ data: null, error: null })

    await markRoomEnded(db, 'room-1')

    const update = lastArgs('update')?.[0] as Record<string, unknown>
    expect(update.status).toBe('completed')
    expect(typeof update.ended_at).toBe('string')
    // 조건부 전이: .in('status', ['pending', 'active'])
    const inCall = calls.find((c) => c.method === 'in')
    expect(inCall?.args).toEqual(['status', ['pending', 'active']])
  })

  it('실패 시 에러를 throw한다', async () => {
    const { db } = createMockDb({ data: null, error: { message: 'y' } })
    await expect(markRoomEnded(db, 'room-1')).rejects.toThrow(/Failed to end room: y/)
  })
})
