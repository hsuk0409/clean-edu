-- Migration: users 테이블에 session_version 컬럼 추가
-- 용도: JWT 강제 무효화 (로그아웃, 계정 탈취 대응)
-- 적용: Supabase Dashboard → SQL Editor에서 실행

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
