-- 비즈니스 앱 전환 후 이메일 기반 식별자로 전환할 때 실행
-- 전제: 모든 users 행에 email 값이 채워져 있어야 함
-- (카카오 account_email scope 승인 후 로그인 시 자동으로 채워짐)

-- 1. email NOT NULL 복원
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- 2. kakao_id 인덱스 및 컬럼 제거 (선택사항 — 남겨둬도 무방)
-- DROP INDEX IF EXISTS idx_users_kakao_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS kakao_id;
