'use client'

import { useSearchParams } from 'next/navigation'

/** useSearchParams는 Suspense 경계 안에서만 사용 가능 */
export default function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  if (!error) return null

  return (
    <div className="mb-5 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
      {error}
    </div>
  )
}
