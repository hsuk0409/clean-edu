/**
 * JWT 서명/검증 — jose 라이브러리 사용 (Edge 런타임 & Node.js 모두 호환).
 * Next.js 의존성 없음 — Nest.js 등 어떤 서버에서도 그대로 사용 가능.
 */
import { SignJWT, jwtVerify } from 'jose'
import type { SessionPayload } from './types'

const ALGORITHM = 'HS256'
const EXPIRATION = '7d'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set. ' +
      'Generate with: openssl rand -base64 32'
    )
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      userId: payload['userId'] as string,
      email: payload['email'] as string,
      name: payload['name'] as string,
      sessionVersion: payload['sessionVersion'] as number,
    }
  } catch {
    return null
  }
}
