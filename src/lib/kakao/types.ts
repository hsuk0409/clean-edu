export interface KakaoTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope?: string
}

export interface KakaoUserInfo {
  kakaoId: number
  email: string
  name: string
}

// Kakao API raw response shapes
export interface KakaoTokenResponse {
  access_token: string
  token_type: string
  refresh_token: string
  expires_in: number
  scope: string
  refresh_token_expires_in: number
}

export interface KakaoUserResponse {
  id: number
  kakao_account?: {
    email?: string
    profile?: {
      nickname?: string
    }
  }
}
