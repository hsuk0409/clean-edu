'use client'

/**
 * WebRTC 오디오 통화 훅 — RTCPeerConnection 생명주기와 시그널링을 관리.
 * 교사(teacher)가 항상 최초 offer를 생성하고, 학부모(parent)는 offer 수신 후 answer로 응답.
 *
 * M4: 실시간 STT + 반복 감지 + Mute/Hold
 * 각 클라이언트가 자신의 발화를 Web Speech API로 인식해 상대에게 중계하고, 교사 클라이언트는
 * 학부모 발화 중 비슷한 내용이 반복되면 스스로 mute하고 학부모에게 안내방송을 송출한 뒤
 * 1분 후 자동 복귀한다 (교사가 직접 전화를 끊는 심리적 부담을 덜기 위함).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendSignal, fetchBacklogSignals, subscribeToSignals } from '@/lib/webrtc/signaling'
import { sendTranscript, subscribeToTranscripts } from '@/lib/webrtc/transcript'
import { playAnnouncementTrack, type AnnouncementHandle } from '@/lib/webrtc/announcement'
import { describeMicError } from '@/lib/webrtc/mic-error'
import { RepetitionDetector } from '@/lib/detection/repetition'
import { useSpeechRecognition } from './useSpeechRecognition'
import type { CallRole, SignalPayload } from '@/lib/webrtc/types'

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
const HOLD_DURATION_SECONDS = 60
const ANNOUNCEMENT_AUDIO_SRC = '/hold-announcement.m4a'

export type CallConnectionState = RTCPeerConnectionState | 'requesting-mic'

export interface UseWebRTCCallResult {
  connectionState: CallConnectionState
  isMuted: boolean
  toggleMute: () => void
  hangUp: () => void
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>
  error: string | null
  /** 반복 발언 감지로 인해 자동 mute + 안내방송이 진행 중인지 (teacher 전용) */
  isHolding: boolean
  /** hold 종료까지 남은 초 (holding이 아니면 0) */
  holdRemainingSeconds: number
  /** STT가 오디오를 잡지 못해 실시간 반복 감지가 동작하지 않는 상태 (마이크 경합 등) */
  sttUnavailable: boolean
}

export function useWebRTCCall(roomId: string, role: CallRole): UseWebRTCCallResult {
  const [connectionState, setConnectionState] = useState<CallConnectionState>('requesting-mic')
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHolding, setIsHolding] = useState(false)
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState(0)

  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioSenderRef = useRef<RTCRtpSender | null>(null)
  const isMutedRef = useRef(false)
  const isHoldingRef = useRef(false)
  const detectorRef = useRef(new RepetitionDetector())
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const announcementRef = useRef<AnnouncementHandle | null>(null)
  const transcriptDbRef = useRef<ReturnType<typeof createClient> | null>(null)

  const getTranscriptDb = useCallback(() => {
    if (!transcriptDbRef.current) transcriptDbRef.current = createClient()
    return transcriptDbRef.current
  }, [])

  const exitHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    announcementRef.current?.stop()
    announcementRef.current = null

    const micTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioSenderRef.current && micTrack) {
      audioSenderRef.current.replaceTrack(micTrack).catch((err) =>
        console.error('[useWebRTCCall] failed to restore mic track after hold', err)
      )
    }
    // hold 이전의 수동 mute 상태로 복귀
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !isMutedRef.current))

    detectorRef.current.reset()
    isHoldingRef.current = false
    setIsHolding(false)
    setHoldRemainingSeconds(0)
  }, [])

  const enterHold = useCallback(() => {
    if (isHoldingRef.current) return
    isHoldingRef.current = true
    setIsHolding(true)
    setHoldRemainingSeconds(HOLD_DURATION_SECONDS)

    // 1. 교사 마이크 즉시 mute (학부모 목소리가 교사에게 전혀 들리지 않게)
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false))

    // 2. 안내방송 트랙으로 교체 (captureStream 미지원 브라우저는 mute만 유지)
    playAnnouncementTrack(ANNOUNCEMENT_AUDIO_SRC)
      .then((handle) => {
        if (!handle || !isHoldingRef.current) {
          handle?.stop()
          return
        }
        announcementRef.current = handle
        audioSenderRef.current?.replaceTrack(handle.track).catch((err) =>
          console.error('[useWebRTCCall] failed to send announcement track', err)
        )
      })
      .catch((err) => console.error('[useWebRTCCall] announcement setup failed', err))

    // 3. 1분 카운트다운 후 자동 복귀
    holdTimerRef.current = setInterval(() => {
      setHoldRemainingSeconds((prev) => {
        if (prev <= 1) {
          exitHold()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [exitHold])

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
      } else if (signal.type === 'hangup') {
        // 상대가 명시적으로 종료 — connectionState 변화(지연되거나 멈출 수 있음)를 기다리지 않고 즉시 반영
        pc.close()
        localStreamRef.current?.getTracks().forEach((t) => t.stop())
        setConnectionState('closed')
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
        const audioTrack = stream.getAudioTracks()[0]
        audioSenderRef.current = pc.addTrack(audioTrack, stream)

        pc.ontrack = (event) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0]
          }
        }
        pc.onconnectionstatechange = () => {
          console.log('[STT-DIAG] role:', role, 'connectionState →', pc.connectionState)
          setConnectionState(pc.connectionState)
        }
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
          setError(describeMicError(err))
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      unsubscribe?.()
      pcRef.current?.close()
      pcRef.current = null
      audioSenderRef.current = null
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
      announcementRef.current?.stop()
    }
  }, [roomId, role])

  // 자신의 발화를 STT로 인식해 상대에게 중계 (연결된 이후에만 — 대기 중 잡음 방지)
  const handleFinalResult = useCallback(
    (text: string) => {
      console.log('[STT-DIAG] handleFinalResult — role:', role, 'text:', text)
      sendTranscript(getTranscriptDb(), roomId, role, text).catch((err) =>
        console.error('[useWebRTCCall] failed to send transcript', err)
      )
    },
    [roomId, role, getTranscriptDb]
  )
  const { isUnavailable: sttUnavailable } = useSpeechRecognition({
    enabled: connectionState === 'connected',
    onFinalResult: handleFinalResult,
  })
  console.log('[STT-DIAG] role:', role, 'connectionState:', connectionState, 'sttUnavailable:', sttUnavailable)

  // 교사만 학부모 발화의 반복을 감지해 hold를 트리거
  useEffect(() => {
    if (role !== 'teacher') return

    const unsubscribe = subscribeToTranscripts(getTranscriptDb(), roomId, (entry) => {
      console.log('[STT-DIAG] teacher received transcript —', entry.speakerRole, ':', entry.text)
      if (entry.speakerRole !== 'parent') return
      const { triggered } = detectorRef.current.push(entry.text)
      if (triggered) enterHold()
    })

    return unsubscribe
  }, [roomId, role, getTranscriptDb, enterHold])

  const toggleMute = useCallback(() => {
    if (isHoldingRef.current) return // hold 중에는 수동 mute 해제 불가
    const stream = localStreamRef.current
    if (!stream) return
    setIsMuted((prev) => {
      const nextMuted = !prev
      isMutedRef.current = nextMuted
      stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted))
      return nextMuted
    })
  }, [])

  const hangUp = useCallback(() => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    announcementRef.current?.stop()
    // 상대에게 즉시 종료를 알림 — best-effort (실패해도 로컬 종료는 계속 진행)
    sendSignal(createClient(), roomId, role, { type: 'hangup' }).catch((err) =>
      console.error('[useWebRTCCall] failed to send hangup signal', err)
    )
    pcRef.current?.close()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    setConnectionState('closed')
  }, [roomId, role])

  return {
    connectionState,
    isMuted,
    toggleMute,
    hangUp,
    remoteAudioRef,
    error,
    isHolding,
    holdRemainingSeconds,
    sttUnavailable,
  }
}
