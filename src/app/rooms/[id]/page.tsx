import { notFound, redirect } from 'next/navigation'
import { getVerifiedSession } from '@/lib/session'
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

  const session = await getVerifiedSession()
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
