-- ============================================================
-- 클린에듀 (Clean-Edu) DB Schema
-- ============================================================

-- ============================================================
-- 1. academies: 학원/기관 (멀티테넌시 루트)
-- ============================================================
CREATE TABLE academies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE, -- URL-friendly 식별자
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. users: 교사 / 직원 계정
-- ============================================================
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id            UUID REFERENCES academies(id) ON DELETE CASCADE,
  -- Supabase Auth와 연동
  auth_id               UUID UNIQUE,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  -- 카카오 토큰 (AES-256 암호화 저장)
  kakao_access_token    TEXT,
  kakao_refresh_token   TEXT,
  kakao_token_expires_at TIMESTAMPTZ,
  -- 상담 쿼터 (분/월)
  monthly_quota_minutes INTEGER NOT NULL DEFAULT 30,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_academy_id ON users(academy_id);
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- ============================================================
-- 3. rooms: WebRTC 상담 방
-- ============================================================
CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 일회용 공유 링크 토큰
  invite_token    TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- 상담 예약 정보
  scheduled_at    TIMESTAMPTZ,
  -- 제한 시간 (기본 15분)
  duration_limit  INTEGER NOT NULL DEFAULT 15, -- minutes
  -- 방 상태
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  -- 실제 통화 시작/종료 시각
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_teacher_id ON rooms(teacher_id);
CREATE INDEX idx_rooms_invite_token ON rooms(invite_token);
CREATE INDEX idx_rooms_status ON rooms(status);

-- ============================================================
-- 4. consultations: 상담 로그 및 AI 요약
-- ============================================================
CREATE TABLE consultations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES users(id),
  -- 전체 STT 대화 로그 (JSON array of {speaker, text, timestamp})
  transcript      JSONB,
  -- Gemini AI 요약본
  ai_summary      TEXT,
  -- 감지된 반복 횟수
  repeat_count    INTEGER NOT NULL DEFAULT 0,
  -- 카카오톡 발송 여부
  kakao_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  kakao_sent_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consultations_room_id ON consultations(room_id);
CREATE INDEX idx_consultations_teacher_id ON consultations(teacher_id);

-- ============================================================
-- 5. WebRTC 시그널링용 임시 메시지 테이블
-- Supabase Realtime을 통한 SDP/ICE 교환에 사용
-- 연결 수립 후 레코드는 자동 삭제 가능
-- ============================================================
CREATE TABLE signaling_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('teacher', 'parent')),
  type        TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate', 'hangup')),
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signaling_room_id ON signaling_messages(room_id);

-- ============================================================
-- 6. call_transcripts: 실시간 STT 전사 중계용 임시 메시지 테이블
-- 각 클라이언트가 Web Speech API로 인식한 자신의 발화를 Supabase Realtime으로
-- 상대방(반복 감지 로직)에 중계. signaling_messages와 동일한 목적의 별도 테이블.
-- ============================================================
CREATE TABLE call_transcripts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  speaker_role TEXT NOT NULL CHECK (speaker_role IN ('teacher', 'parent')),
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_transcripts_room_id ON call_transcripts(room_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- academies: 읽기 공개, 쓰기는 인증된 사용자만
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academies_read" ON academies FOR SELECT USING (true);
CREATE POLICY "academies_insert" ON academies FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- users: 본인 데이터만 접근
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_self" ON users
  FOR ALL USING (auth.uid() = auth_id);

-- rooms: 교사 본인의 방만 접근, invite_token으로 학부모 조회 허용
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_teacher_own" ON rooms
  FOR ALL USING (teacher_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "rooms_invite_read" ON rooms
  FOR SELECT USING (invite_token IS NOT NULL); -- 학부모용 (공개 조회)

-- consultations: 교사 본인만 접근
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consultations_teacher_own" ON consultations
  FOR ALL USING (teacher_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- signaling_messages: 방 참여자만 접근 (Realtime 활용)
ALTER TABLE signaling_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signaling_public_read" ON signaling_messages FOR SELECT USING (true);
CREATE POLICY "signaling_insert" ON signaling_messages FOR INSERT WITH CHECK (true);

-- call_transcripts: 학부모는 Supabase Auth 세션이 없으므로 signaling_messages와 동일하게 공개 read/insert
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_transcripts_public_read" ON call_transcripts FOR SELECT USING (true);
CREATE POLICY "call_transcripts_insert" ON call_transcripts FOR INSERT WITH CHECK (true);

-- ============================================================
-- Realtime Publication
-- postgres_changes 구독(subscribeToSignals)이 INSERT 이벤트를 받으려면
-- 테이블이 supabase_realtime publication에 명시적으로 추가되어야 함
-- (RLS만 열려있고 이 설정이 빠지면 insert는 되지만 이벤트가 발행되지 않음)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE signaling_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE call_transcripts;

-- ============================================================
-- 자동 updated_at 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_academies_updated_at BEFORE UPDATE ON academies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_consultations_updated_at BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
