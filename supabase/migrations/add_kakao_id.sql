-- kakao_id 컬럼 추가 및 email을 선택적으로 변경
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kakao_id BIGINT UNIQUE,
  ALTER COLUMN email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
