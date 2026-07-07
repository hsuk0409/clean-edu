'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CreatedRoom {
  id: string
  invite_token: string
}

export function CreateRoomCard() {
  const router = useRouter()
  const [room, setRoom] = useState<CreatedRoom | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rooms', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? '통화방 생성에 실패했습니다.')
      }
      const { room } = await res.json()
      setRoom(room)
    } catch (err) {
      setError(err instanceof Error ? err.message : '통화방 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = room
    ? `${window.location.origin}/call/${room.invite_token}`
    : null

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!room) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center">
        <p className="text-zinc-500 text-sm mb-4">새 상담 통화방을 만들어 학부모에게 링크를 공유하세요.</p>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={loading}
          className="rounded-full bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {loading ? '생성 중...' : '통화방 만들기'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-10 rounded-2xl border border-zinc-100 bg-white p-8">
      <p className="text-zinc-900 font-medium mb-1">통화방이 생성되었습니다</p>
      <p className="text-zinc-500 text-sm mb-4">아래 링크를 학부모에게 전달하세요.</p>
      <div className="flex items-center gap-2 mb-6">
        <input
          readOnly
          value={shareUrl ?? ''}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 bg-zinc-50"
        />
        <button
          onClick={handleCopy}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0"
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <button
        onClick={() => router.push(`/rooms/${room.id}`)}
        className="rounded-full bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
      >
        통화방 입장하기
      </button>
    </div>
  )
}
