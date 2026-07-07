import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRoomByInviteToken } from '@/lib/rooms'
import { ParentCallClient } from './ParentCallClient'

export const metadata = { title: '상담 통화 — 클린에듀' }

export default async function ParentCallPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const db = createAdminClient()
  const room = await getRoomByInviteToken(db, token)

  if (!room) {
    notFound()
  }

  if (room.status === 'completed' || room.status === 'cancelled') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white px-6 text-center">
        <p className="text-xl font-medium mb-2">이미 종료된 상담입니다</p>
        <p className="text-zinc-400 text-sm">담당 선생님께 새 링크를 요청해주세요.</p>
      </div>
    )
  }

  return <ParentCallClient roomId={room.id} durationLimitMinutes={room.duration_limit} />
}
