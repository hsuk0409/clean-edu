'use client'

/**
 * WebRTC 오디오 통화 훅 — RTCPeerConnection 생명주기와 시그널링을 관리.
 * 교사(teacher)가 항상 최초 offer를 생성하고, 학부모(parent)는 offer 수신 후 answer로 응답.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendSignal, fetchBacklogSignals, subscribeToSignals } from '@/lib/webrtc/signaling'
import type { CallRole, SignalPayload } from '@/lib/webrtc/types'

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

export type CallConnectionState = RTCPeerConnectionState | 'requesting-mic'

export interface UseWebRTCCallResult {
  connectionState: CallConnectionState
  isMuted: boolean
  toggleMute: () => void
  hangUp: () => void
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>
  error: string | null
}

export function useWebRTCCall(roomId: string, role: CallRole): UseWebRTCCallResult {
  const [connectionState, setConnectionState] = useState<CallConnectionState>('requesting-mic')
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false
    const db = createClient()
    const pendingCandidates: RTCIceCandidateInit[] = []

    async function flushPendingCandidates(pc: RTCPeerConnection) {
      while (pendingCandidates.length > 0) {
        const candidate = pendingCandidates.shift()!
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    }

    async function handleSignal(pc: RTCPeerConnection, signal: SignalPayload) {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        await flushPendingCandidates(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal(db, roomId, role, { type: 'answer', sdp: answer })
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        await flushPendingCandidates(pc)
      } else if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
      } else {
        pendingCandidates.push(signal.candidate)
      }
    }

    let unsubscribe: (() => void) | null = null

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream
        setConnectionState('new')

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pcRef.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        pc.ontrack = (event) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0]
          }
        }
        pc.onconnectionstatechange = () => setConnectionState(pc.connectionState)
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignal(db, roomId, role, {
              type: 'ice-candidate',
              candidate: event.candidate.toJSON(),
            }).catch((err) => console.error('[WebRTC] Failed to send ICE candidate', err))
          }
        }

        // Realtime 구독을 먼저 열고, backlog 처리가 끝날 때까지는 큐잉만 한다.
        // (backlog 조회와 실시간 구독 사이의 레이스로 메시지가 유실되는 것을 방지)
        const processedIds = new Set<string>()
        const liveBuffer: Array<{ id: string; signal: SignalPayload }> = []
        let backlogDone = false

        unsubscribe = subscribeToSignals(db, roomId, role, (id, signal) => {
          if (backlogDone) {
            if (!processedIds.has(id)) {
              processedIds.add(id)
              handleSignal(pc, signal).catch((err) => console.error('[WebRTC] signal error', err))
            }
          } else {
            liveBuffer.push({ id, signal })
          }
        })

        const backlog = await fetchBacklogSignals(db, roomId, role)
        for (const { id, signal } of backlog) {
          processedIds.add(id)
          await handleSignal(pc, signal)
        }
        for (const { id, signal } of liveBuffer) {
          if (!processedIds.has(id)) {
            processedIds.add(id)
            await handleSignal(pc, signal)
          }
        }
        backlogDone = true

        // 교사가 상담방의 최초 개시자 — 이전에 offer를 보낸 적 없으면 새로 생성
        const alreadyOffered = backlog.some((b) => b.signal.type === 'offer')
        if (role === 'teacher' && !alreadyOffered) {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await sendSignal(db, roomId, role, { type: 'offer', sdp: offer })
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : '마이크 권한을 확인하고 다시 시도해주세요.'
          )
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      unsubscribe?.()
      pcRef.current?.close()
      pcRef.current = null
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
  }, [roomId, role])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    setIsMuted((prev) => {
      const nextMuted = !prev
      stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted))
      return nextMuted
    })
  }, [])

  const hangUp = useCallback(() => {
    pcRef.current?.close()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    setConnectionState('closed')
  }, [])

  return { connectionState, isMuted, toggleMute, hangUp, remoteAudioRef, error }
}
