/**
 * getUserMedia 실패 시 브라우저가 던지는 예외(DOMException)를 사용자에게 보여줄
 * 한국어 안내 문구로 변환한다. 브라우저별로 DOMException이 Error를 상속하는지
 * 여부가 스펙상 보장되지 않으므로 duck typing(instanceof Error + name)으로 판별한다.
 */
export function describeMicError(err: unknown): string {
  const name = err instanceof Error ? err.name : undefined

  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지, 브라우저에 마이크 접근 권한이 허용되어 있는지 확인해주세요.'
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '마이크 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 마이크 접근을 허용한 뒤 새로고침해주세요.'
    case 'NotReadableError':
    case 'TrackStartError':
      return '마이크를 사용할 수 없습니다. 다른 프로그램이 마이크를 사용 중인지 확인한 뒤 다시 시도해주세요.'
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return '현재 마이크가 통화에 필요한 설정을 지원하지 않습니다.'
    case 'SecurityError':
      return '보안 연결(HTTPS)에서만 마이크를 사용할 수 있습니다.'
    default:
      return '마이크를 여는 중 문제가 발생했습니다. 마이크 연결 상태를 확인하고 다시 시도해주세요.'
  }
}
