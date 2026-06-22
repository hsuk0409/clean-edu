export interface SessionPayload {
  userId: string        // users.id (UUID)
  email: string
  name: string
  sessionVersion: number  // users.session_version — 강제 무효화용
}
