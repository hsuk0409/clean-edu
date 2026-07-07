import { notFound, redirect } from 'next/navigation'
import { getTokenFromCookies } from '@/lib/session/cookie'
import { verifySession } from '@/lib/session/jwt'
import { verifySessionVersion } from '@/lib/session/db-verify'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRoomById } from '@/lib/rooms'
import { TeacherCallClient } from './TeacherCallClient'

export const metadata = { title: '통화방 — 클린에듀' }

export default async function TeacherRoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const token = await getTokenFromCookies()
  const jwtSession = token ? await verifySession(token) : null
  const session = jwtSession ? await verifySessionVersion(jwtSession) : null

  if (!session) {
    redirect('/login')
  }

  const db = createAdminClient()
  const room = await getRoomById(db, id)

  if (!room || room.teacher_id !== session.userId) {
    notFound()
  }

  return <TeacherCallClient roomId={room.id} durationLimitMinutes={room.duration_limit} />
}
