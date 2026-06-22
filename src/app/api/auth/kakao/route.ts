import { NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/kakao/auth'

/** GET /api/auth/kakao — 카카오 로그인 페이지로 리다이렉트 */
export async function GET() {
  const url = buildAuthUrl({
    restApiKey: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!,
    clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/kakao/callback`,
  })
  return NextResponse.redirect(url)
}
