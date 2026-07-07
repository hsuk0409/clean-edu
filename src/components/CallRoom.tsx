'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useWebRTCCall } from '@/hooks/useWebRTCCall'
import type { CallRole } from '@/lib/webrtc/types'

interface CallRoomProps {
  roomId: string
  role: CallRole
  durationLimitMinutes: number
  /** 통화 종료(수동/타이머만료) 후 처리 — 페이지별로 리다이렉트 등 다르게 구현 */
  onEnded: () => void
}

const CONNECTION_STATE_LABEL: Record<string, string> = {
  'requesting-mic': '마이크 권한 요청 중...',
  new: '상대방을 기다리는 중...',
  connecting: '연결 중...',
  connected: '통화 연결됨',
  disconnected: '연결이 끊겼습니다. 재연결 시도 중...',
  failed: '연결에 실패했습니다',
  closed: '통화가 종료되었습니다',
}

export function CallRoom({ roomId, role, durationLimitMinutes, onEnded }: CallRoomProps) {
  const { connectionState, isMuted, toggleMute, hangUp, remoteAudioRef, error } =
    useWebRTCCall(roomId, role)

  const [remainingSeconds, setRemainingSeconds] = useState(durationLimitMinutes * 60)
  const hasStartedRef = useRef(false)
  const hasEndedRef = useRef(false)

  const endCall = useCallback(() => {
    if (hasEndedRef.current) return
    hasEndedRef.current = true
    hangUp()
    fetch(`/api/rooms/${roomId}/end`, { method: 'POST' }).catch((err) =>
      console.error('[CallRoom] Failed to mark room ended', err)
    )
    onEnded()
  }, [hangUp, onEnded, roomId])

  // 최초 연결 성공 시 방을 active 상태로 전이
  useEffect(() => {
    if (connectionState === 'connected' && !hasStartedRef.current) {
      hasStartedRef.current = true
      fetch(`/api/rooms/${roomId}/start`, { method: 'POST' }).catch((err) =>
        console.error('[CallRoom] Failed to mark room started', err)
      )
    }
  }, [connectionState, roomId])

  // 연결된 이후에만 카운트다운 시작
  useEffect(() => {
    if (connectionState !== 'connected') return

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          endCall()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [connectionState, endCall])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white px-6">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <p className="text-zinc-400 text-sm mb-2">
        {CONNECTION_STATE_LABEL[connectionState] ?? connectionState}
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <p className="text-5xl font-bold tabular-nums mb-10">{timerText}</p>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleMute}
          className="rounded-full w-14 h-14 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 transition-colors text-xl"
          aria-label={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted ? '🔇' : '🎙️'}
        </button>
        <button
          onClick={endCall}
          className="rounded-full w-14 h-14 flex items-center justify-center bg-red-600 hover:bg-red-500 transition-colors text-xl"
          aria-label="통화 종료"
        >
          📞
        </button>
      </div>
    </div>
  )
}
