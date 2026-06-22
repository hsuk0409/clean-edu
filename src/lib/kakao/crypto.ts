/**
 * AES-256-GCM 기반 토큰 암호화/복호화.
 * Node.js 내장 crypto 모듈만 사용 — 어떤 Node.js 서버에서도 그대로 사용 가능.
 * (Edge 런타임 불가 — API Route 또는 서버 전용)
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // GCM 권장 96-bit IV

function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set. ' +
      'Generate with: openssl rand -hex 32'
    )
  }
  const buf = Buffer.from(keyHex, 'hex')
  if (buf.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)')
  }
  return buf
}

/**
 * 평문을 AES-256-GCM으로 암호화.
 * 반환 형식: "iv:authTag:ciphertext" (모두 hex)
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * encrypt()로 암호화된 문자열 복호화.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format')
  }
  const [ivHex, tagHex, dataHex] = parts
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(dataHex, 'hex', 'utf8') + decipher.final('utf8')
}
