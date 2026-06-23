/**
 * Kakao OAuth 2.0 핵심 로직.
 * Next.js 의존성 없음 — Nest.js, Express 등 어떤 서버에서도 그대로 사용 가능.
 */
import type {
  KakaoTokens,
  KakaoTokenResponse,
  KakaoUserInfo,
  KakaoUserResponse,
} from './types'

const KAKAO_AUTH_BASE = 'https://kauth.kakao.com'
const KAKAO_API_BASE = 'https://kapi.kakao.com'

export interface KakaoOAuthConfig {
  restApiKey: string
  clientSecret: string
  redirectUri: string
}

/** 카카오 로그인 페이지 URL 생성 */
export function buildAuthUrl(config: KakaoOAuthConfig, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.restApiKey,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'profile_nickname,profile_image',
  })
  if (state) params.set('state', state)
  return `${KAKAO_AUTH_BASE}/oauth/authorize?${params}`
}

/** 인가 코드 → 액세스/리프레시 토큰 교환 */
export async function exchangeCode(
  config: KakaoOAuthConfig,
  code: string
): Promise<KakaoTokens> {
  const res = await fetch(`${KAKAO_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.restApiKey,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Kakao token exchange failed (${res.status}): ${body}`)
  }

  return toKakaoTokens(await res.json() as KakaoTokenResponse)
}

/** 리프레시 토큰으로 액세스 토큰 갱신 */
export async function refreshTokens(
  config: Pick<KakaoOAuthConfig, 'restApiKey' | 'clientSecret'>,
  refreshToken: string
): Promise<KakaoTokens> {
  const res = await fetch(`${KAKAO_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.restApiKey,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Kakao token refresh failed (${res.status}): ${body}`)
  }

  const data = await res.json() as KakaoTokenResponse
  // 리프레시 갱신 응답에는 refresh_token이 없을 수 있으므로 기존 값 유지
  return {
    ...toKakaoTokens(data),
    refreshToken: data.refresh_token ?? refreshToken,
  }
}

/** 액세스 토큰으로 사용자 정보 조회 */
export async function getUserInfo(accessToken: string): Promise<KakaoUserInfo> {
  const res = await fetch(`${KAKAO_API_BASE}/v2/user/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Kakao user info fetch failed (${res.status})`)
  }

  const data = await res.json() as KakaoUserResponse
  return {
    kakaoId: data.id,
    email: data.kakao_account?.email ?? '',
    name: data.kakao_account?.profile?.nickname ?? '',
  }
}

function toKakaoTokens(data: KakaoTokenResponse): KakaoTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  }
}
