import { redirect } from 'next/navigation'
import { getTokenFromCookies } from '@/lib/session/cookie'
import { verifySession } from '@/lib/session/jwt'
import { verifySessionVersion } from '@/lib/session/db-verify'

/**
 * Dashboard 레이아웃 — 2단계 세션 검증
 * 1단계(미들웨어): JWT 서명 검증 (Edge, DB 조회 없음)
 * 2단계(여기):     DB의 session_version과 대조 (강제 로그아웃 반영)
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const token = await getTokenFromCookies()
  const jwtSession = token ? await verifySession(token) : null

  if (!jwtSession) {
    redirect('/login')
  }

  // JWT가 유효해도 session_version이 DB와 다르면 강제 로그인 페이지로
  const session = await verifySessionVersion(jwtSession)
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-zinc-900 text-lg">클린에듀</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600">{session.name} 선생님</span>
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        로그아웃
      </button>
    </form>
  )
}
