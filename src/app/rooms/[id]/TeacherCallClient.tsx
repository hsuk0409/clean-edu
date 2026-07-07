'use client'

import { useRouter } from 'next/navigation'
import { CallRoom } from '@/components/CallRoom'

export function TeacherCallClient({
  roomId,
  durationLimitMinutes,
}: {
  roomId: string
  durationLimitMinutes: number
}) {
  const router = useRouter()

  return (
    <CallRoom
      roomId={roomId}
      role="teacher"
      durationLimitMinutes={durationLimitMinutes}
      onEnded={() => router.push('/dashboard')}
    />
  )
}
