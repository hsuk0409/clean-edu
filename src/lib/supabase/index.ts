/**
 * Supabase 클라이언트 선택 가이드
 *
 * | 상황                              | import 경로                          |
 * |-----------------------------------|--------------------------------------|
 * | 클라이언트 컴포넌트 (브라우저)     | @/lib/supabase/client → createClient |
 * | 서버 컴포넌트 / Route Handler      | @/lib/supabase/server → createClient |
 * | Service Role (RLS 우회 필요)       | @/lib/supabase/admin  → createAdminClient |
 * | Next.js 미들웨어                  | @/lib/supabase/middleware (내부 전용) |
 */

export { createClient as createBrowserClient } from './client'
export { createClient as createServerClient } from './server'
export { createAdminClient } from './admin'
