'use client'

/**
 * Web Speech API(SpeechRecognition) 래핑 훅 — 자신의 마이크 입력을 실시간으로 전사해
 * 문장이 확정(final)될 때마다 콜백으로 전달한다.
 * 브라우저가 무음/타임아웃 등으로 인식을 자동 종료시키면(continuous 모드에서도 발생) 재시작한다.
 *
 * 견고성: 인식기가 오디오 캡처(onaudiostart)에 성공하지 못한 채 즉시 종료되는 상황
 * (예: 한 기기에서 마이크를 두고 여러 SpeechRecognition/getUserMedia가 경합)에서는
 * 재시작을 지수 backoff로 늦추고, 연속 실패가 임계값을 넘으면 `isUnavailable`로 알린다.
 * (backoff가 없으면 초당 수십 번 start/end를 반복하며 CPU·콘솔을 태운다)
 */
import { useEffect, useRef, useState } from 'react'

export interface UseSpeechRecognitionOptions {
  /** 인식 활성화 여부 — 마이크 준비 전에는 false로 두어 중복 시작을 방지 */
  enabled: boolean
  lang?: string
  onFinalResult: (text: string) => void
}

export interface UseSpeechRecognitionResult {
  /** 브라우저가 SpeechRecognition을 지원하지 않으면 false (예: Firefox) */
  isSupported: boolean
  /** 인식기가 오디오를 잡지 못해(마이크 경합 등) STT가 사실상 동작 불가로 판단된 상태 */
  isUnavailable: boolean
}

/** 오디오 캡처 성공 후 정상 종료 시 빠른 재시작 간격 */
const HEALTHY_RESTART_MS = 250
/** 오디오 캡처 실패가 반복될 때 backoff 상한 */
const MAX_BACKOFF_MS = 4000
/** 오디오 캡처 없이 연속 종료가 이 횟수를 넘으면 동작 불가로 판단 */
const UNAVAILABLE_THRESHOLD = 4

export function useSpeechRecognition({
  enabled,
  lang = 'ko-KR',
  onFinalResult,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  )
  const [isUnavailable, setIsUnavailable] = useState(false)
  const onFinalResultRef = useRef(onFinalResult)
  useEffect(() => {
    onFinalResultRef.current = onFinalResult
  })

  useEffect(() => {
    if (!enabled || !isSupported) return

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = false

    let stopped = false
    let capturedAudio = false // 이번 인식 세션에서 오디오 캡처(onaudiostart)에 성공했는지
    let failStreak = 0 // 오디오 캡처 없이 연속 종료된 횟수
    let restartTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRestart = () => {
      if (stopped) return
      let delay: number
      if (capturedAudio) {
        // 정상적으로 듣다가 무음 등으로 끝난 경우 — 빠르게 재개
        delay = HEALTHY_RESTART_MS
      } else {
        // 오디오를 못 잡고 즉시 끝난 경우 — 지수 backoff로 thrash 방지
        failStreak += 1
        if (failStreak >= UNAVAILABLE_THRESHOLD) setIsUnavailable(true)
        delay = Math.min(HEALTHY_RESTART_MS * 2 ** failStreak, MAX_BACKOFF_MS)
      }
      restartTimer = setTimeout(() => {
        if (stopped) return
        try {
          recognition.start()
        } catch {
          // 이미 시작된 상태에서의 재시작 호출은 무시
        }
      }, delay)
    }

    recognition.onstart = () => {
      capturedAudio = false
    }

    recognition.onaudiostart = () => {
      capturedAudio = true
      failStreak = 0
      setIsUnavailable(false)
    }

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) onFinalResultRef.current(text)
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('[useSpeechRecognition] error', event.error)
    }

    recognition.onend = () => {
      scheduleRestart()
    }

    try {
      recognition.start()
    } catch (err) {
      console.error('[useSpeechRecognition] failed to start', err)
    }

    return () => {
      stopped = true
      if (restartTimer) clearTimeout(restartTimer)
      recognition.onstart = null
      recognition.onaudiostart = null
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.stop()
    }
  }, [enabled, isSupported, lang])

  return { isSupported, isUnavailable }
}
