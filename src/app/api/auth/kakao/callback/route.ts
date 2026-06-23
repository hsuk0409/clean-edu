import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCode, getUserInfo } from '@/lib/kakao/auth'
import { saveTokens } from '@/lib/kakao/token-store'
import { signSession } from '@/lib/session/jwt'
import { setSessionCookie } from '@/lib/session/cookie'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

const kakaoConfig = {
  restApiKey: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!,
  clientSecret: process.env.KAKAO_CLIENT_SECRET!,
  redirectUri: `${APP_URL}/api/auth/kakao/callback`,
}

/** GET /api/auth/kakao/callback — 카카오 OAuth 콜백 처리 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    const reason = searchParams.get('error_description') ?? '로그인이 취소되었습니다.'
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(reason)}`, APP_URL)
    )
  }

  try {
    // 1. 인가 코드 → 토큰 교환
    const tokens = await exchangeCode(kakaoConfig, code)

    // 2. 카카오 사용자 정보 조회
    const userInfo = await getUserInfo(tokens.accessToken)

    // 3. DB에서 사용자 조회 또는 신규 생성
    // TODO(비즈니스 앱 전환 후): kakaoId 대신 email로 식별하도록 변경
    //   - upsertUser(db, userInfo.email, userInfo.name) 로 교체
    //   - email 없을 경우 에러 처리 복원
    //   - supabase/migrations/switch_to_email_identifier.sql 실행
    const db = createAdminClient()
    const { userId, sessionVersion } = await upsertUser(db, userInfo.kakaoId, userInfo.name, userInfo.email || null)

    // 4. Kakao 토큰 암호화 저장
    await saveTokens(db, userId, tokens)

    // 5. JWT 세션 생성 (sessionVersion 포함) 및 쿠키 설정
    const sessionToken = await signSession({
      userId,
      email: userInfo.email || '',
      name: userInfo.name,
      sessionVersion,
    })

    const response = NextResponse.redirect(new URL('/dashboard', APP_URL))
    setSessionCookie(response, sessionToken)
    return response
  } catch (err) {
    console.error('[Kakao callback error]', err)
    return NextResponse.redirect(
      new URL('/login?error=로그인 처리 중 오류가 발생했습니다.', APP_URL)
    )
  }
}

async function upsertUser(
  db: ReturnType<typeof createAdminClient>,
  kakaoId: number,
  name: string,
  email: string | null
): Promise<{ userId: string; sessionVersion: number }> {
  const { data: existing } = await db
    .from('users')
    .select('id, session_version')
    .eq('kakao_id', kakaoId)
    .maybeSingle()

  if (existing) {
    await db.from('users').update({ name, ...(email && { email }) }).eq('id', existing.id)
    return { userId: existing.id, sessionVersion: existing.session_version }
  }

  const { data: created, error } = await db
    .from('users')
    .insert({ kakao_id: kakaoId, name, ...(email && { email }) })
    .select('id, session_version')
    .single()

  if (error || !created) {
    throw new Error(`Failed to create user: ${error?.message}`)
  }

  return { userId: created.id, sessionVersion: created.session_version }
}
