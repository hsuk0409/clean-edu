/**
 * 테스트용 Supabase 쿼리 빌더 목(mock).
 *
 * 실제 SupabaseClient는 `.from().select().eq()...` 처럼 체이닝되며 어느 단계에서든
 * await 가능한(thenable) 빌더를 반환한다. 이 목은 모든 체이닝 메서드가 자기 자신을
 * 반환하고, await 시 미리 지정한 result로 resolve한다.
 *  - 호출된 메서드/인자는 `calls`에 순서대로 기록되어 검증에 사용한다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface MockCall {
  method: string
  args: unknown[]
}

export interface MockDbResult {
  data?: unknown
  error?: unknown
}

export interface MockDb {
  db: SupabaseClient<Database>
  calls: MockCall[]
  /** method 이름으로 마지막 호출 인자를 조회 */
  lastArgs(method: string): unknown[] | undefined
}

const CHAIN_METHODS = ['from', 'insert', 'select', 'eq', 'neq', 'in', 'order', 'update']
const TERMINAL_METHODS = ['single', 'maybeSingle']

export function createMockDb(result: MockDbResult = { data: null, error: null }): MockDb {
  const calls: MockCall[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {}

  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }

  for (const method of TERMINAL_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return Promise.resolve(result)
    }
  }

  // 빌더 자체를 await 가능하게 (insert/update/order 등에서 바로 await 하는 경로 지원)
  builder.then = (
    onFulfilled?: (value: MockDbResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected)

  return {
    db: builder as SupabaseClient<Database>,
    calls,
    lastArgs(method: string) {
      for (let i = calls.length - 1; i >= 0; i--) {
        if (calls[i].method === method) return calls[i].args
      }
      return undefined
    },
  }
}
