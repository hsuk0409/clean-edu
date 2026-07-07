'use client'

import { useState } from 'react'
import { CallRoom } from '@/components/CallRoom'

export function ParentCallClient({
  roomId,
  durationLimitMinutes,
}: {
  roomId: string
  durationLimitMinutes: number
}) {
  const [ended, setEnded] = useState(false)

  if (ended) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white px-6 text-center">
        <p className="text-xl font-medium mb-2">통화가 종료되었습니다</p>
        <p className="text-zinc-400 text-sm">상담해주셔서 감사합니다.</p>
      </div>
    )
  }

  return (
    <CallRoom
      roomId={roomId}
      role="parent"
      durationLimitMinutes={durationLimitMinutes}
      onEnded={() => setEnded(true)}
    />
  )
}
