import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Service Role 클라이언트 — RLS를 우회하는 관리자 권한.
 *
 * 사용 규칙:
 * - 서버사이드 전용 (API Route, Server Action, 별도 서버 앱)
 * - 클라이언트 컴포넌트나 NEXT_PUBLIC_ 변수에 절대 노출 금지
 * - 별도 서버 앱(Express, Hono 등)에서도 이 파일을 그대로 임포트 가능
 *   (Next.js 종속성 없음 — @supabase/supabase-js만 사용)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase admin credentials. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.'
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
