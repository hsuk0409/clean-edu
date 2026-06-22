/**
 * Kakao 토큰 영속화 레이어.
 * SupabaseClient를 주입받아 동작 → DB 어댑터 교체 시 이 파일만 수정.
 * Next.js 의존성 없음.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { KakaoTokens } from './types'
import type { KakaoOAuthConfig } from './auth'
import { encrypt, decrypt } from './crypto'
import { refreshTokens } from './auth'

type DbClient = SupabaseClient<Database>

/** 액세스 토큰 만료 5분 전에 자동 갱신 */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

/** 암호화된 Kakao 토큰을 DB에 저장 */
export async function saveTokens(
  db: DbClient,
  userId: string,
  tokens: KakaoTokens
): Promise<void> {
  const { error } = await db
    .from('users')
    .update({
      kakao_access_token: encrypt(tokens.accessToken),
      kakao_refresh_token: encrypt(tokens.refreshToken),
      kakao_token_expires_at: tokens.expiresAt.toISOString(),
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to save Kakao tokens: ${error.message}`)
  }
}

/**
 * 유효한 Kakao 액세스 토큰을 반환.
 * 만료 임박 시 자동으로 갱신 후 DB 업데이트.
 */
export async function getValidTokens(
  db: DbClient,
  userId: string,
  config: Pick<KakaoOAuthConfig, 'restApiKey' | 'clientSecret'>
): Promise<KakaoTokens | null> {
  const { data, error } = await db
    .from('users')
    .select('kakao_access_token, kakao_refresh_token, kakao_token_expires_at')
    .eq('id', userId)
    .single()

  if (error || !data?.kakao_access_token || !data?.kakao_refresh_token) {
    return null
  }

  const expiresAt = new Date(data.kakao_token_expires_at!)
  const tokens: KakaoTokens = {
    accessToken: decrypt(data.kakao_access_token),
    refreshToken: decrypt(data.kakao_refresh_token),
    expiresAt,
  }

  if (Date.now() >= expiresAt.getTime() - REFRESH_BUFFER_MS) {
    const refreshed = await refreshTokens(config, tokens.refreshToken)
    await saveTokens(db, userId, refreshed)
    return refreshed
  }

  return tokens
}
