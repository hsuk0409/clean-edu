'use client'

/**
 * Web Speech API(SpeechRecognition) 래핑 훅 — 자신의 마이크 입력을 실시간으로 전사해
 * 문장이 확정(final)될 때마다 콜백으로 전달한다.
 * 브라우저가 무음/타임아웃 등으로 인식을 자동 종료시키면(continuous 모드에서도 발생) 재시작한다.
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
}

export function useSpeechRecognition({
  enabled,
  lang = 'ko-KR',
  onFinalResult,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  )
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
      if (stopped) return
      try {
        recognition.start()
      } catch {
        // 이미 시작된 상태에서의 재시작 호출은 무시
      }
    }

    try {
      recognition.start()
    } catch (err) {
      console.error('[useSpeechRecognition] failed to start', err)
    }

    return () => {
      stopped = true
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.stop()
    }
  }, [enabled, isSupported, lang])

  return { isSupported }
}
