import { describe, it, expect } from 'vitest'
import { describeMicError } from './mic-error'

function errorWithName(name: string): Error {
  const err = new Error('raw browser message')
  err.name = name
  return err
}

describe('describeMicError', () => {
  it('NotFoundError는 장치를 찾을 수 없다는 안내를 반환한다', () => {
    expect(describeMicError(errorWithName('NotFoundError'))).toMatch(/마이크를 찾을 수 없습니다/)
  })

  it('NotAllowedError는 권한 거부 안내를 반환한다', () => {
    expect(describeMicError(errorWithName('NotAllowedError'))).toMatch(/권한이 거부/)
  })

  it('NotReadableError는 사용 중 안내를 반환한다', () => {
    expect(describeMicError(errorWithName('NotReadableError'))).toMatch(/다른 프로그램/)
  })

  it('OverconstrainedError는 설정 미지원 안내를 반환한다', () => {
    expect(describeMicError(errorWithName('OverconstrainedError'))).toMatch(/설정을 지원하지 않습니다/)
  })

  it('SecurityError는 HTTPS 안내를 반환한다', () => {
    expect(describeMicError(errorWithName('SecurityError'))).toMatch(/보안 연결/)
  })

  it('알 수 없는 에러 이름은 일반 안내로 폴백한다', () => {
    expect(describeMicError(errorWithName('SomeWeirdError'))).toMatch(/문제가 발생했습니다/)
  })

  it('Error가 아닌 값도 일반 안내로 폴백한다', () => {
    expect(describeMicError('not an error')).toMatch(/문제가 발생했습니다/)
    expect(describeMicError(undefined)).toMatch(/문제가 발생했습니다/)
  })
})
