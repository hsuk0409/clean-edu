-- ============================================================
-- signaling_messages.type에 'hangup' 시그널 타입 추가
-- 상대가 통화 종료 버튼을 누른 즉시 알리기 위함 (기존에는 WebRTC
-- connectionState 변화에만 의존해 상대가 끊어도 "재연결 시도 중"에
-- 멈춰있는 문제가 있었음)
-- ============================================================
ALTER TABLE signaling_messages DROP CONSTRAINT IF EXISTS signaling_messages_type_check;
ALTER TABLE signaling_messages ADD CONSTRAINT signaling_messages_type_check
  CHECK (type IN ('offer', 'answer', 'ice-candidate', 'hangup'));
