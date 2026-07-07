-- ============================================================
-- M4: 실시간 STT 전사 중계용 테이블
-- 각 클라이언트가 자신의 음성을 Web Speech API로 인식한 결과를
-- Supabase Realtime을 통해 상대방(및 반복 감지 로직)에 중계한다.
-- ============================================================
CREATE TABLE call_transcripts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  speaker_role TEXT NOT NULL CHECK (speaker_role IN ('teacher', 'parent')),
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_transcripts_room_id ON call_transcripts(room_id);

ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
-- signaling_messages와 동일한 이유: 학부모는 Supabase Auth 세션이 없으므로 공개 read/insert
CREATE POLICY "call_transcripts_public_read" ON call_transcripts FOR SELECT USING (true);
CREATE POLICY "call_transcripts_insert" ON call_transcripts FOR INSERT WITH CHECK (true);

-- postgres_changes 구독이 INSERT 이벤트를 받으려면 publication에 명시적으로 추가 필요
-- (signaling_messages 트러블슈팅 참고: RLS만으로는 부족함)
ALTER PUBLICATION supabase_realtime ADD TABLE call_transcripts;
