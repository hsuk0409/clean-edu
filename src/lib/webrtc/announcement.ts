'use client'

/**
 * Hold(반복 감지) 상태에서 학부모에게 들려줄 안내방송 오디오를 재생하고,
 * 그 출력을 MediaStreamTrack으로 캡처해 RTCRtpSender.replaceTrack에 넘길 수 있게 한다.
 * captureStream은 비표준 API라 미지원 브라우저(등)에서는 null을 반환 — 호출부는 이 경우
 * 안내방송 없이 mute만 유지하는 것으로 폴백해야 한다.
 */

type CaptureCapableAudio = HTMLAudioElement & {
  captureStream?: () => MediaStream
  mozCaptureStream?: () => MediaStream
}

export interface AnnouncementHandle {
  track: MediaStreamTrack
  stop: () => void
}

export async function playAnnouncementTrack(src: string): Promise<AnnouncementHandle | null> {
  const audio = new Audio(src) as CaptureCapableAudio
  audio.loop = true

  const captureStream = audio.captureStream ?? audio.mozCaptureStream
  if (!captureStream) {
    console.warn('[announcement] captureStream unsupported in this browser')
    return null
  }

  try {
    await audio.play()
  } catch (err) {
    console.error('[announcement] failed to play announcement audio', err)
    return null
  }

  const stream = captureStream.call(audio)
  const track = stream.getAudioTracks()[0]
  if (!track) {
    audio.pause()
    return null
  }

  return {
    track,
    stop: () => {
      audio.pause()
      audio.currentTime = 0
    },
  }
}
