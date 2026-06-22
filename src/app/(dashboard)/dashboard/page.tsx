import { getTokenFromCookies } from '@/lib/session/cookie'
import { verifySession } from '@/lib/session/jwt'

export const metadata = { title: '대시보드 — 클린에듀' }

export default async function DashboardPage() {
  const token = await getTokenFromCookies()
  const session = token ? await verifySession(token) : null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-1">
        안녕하세요, {session?.name} 선생님 👋
      </h1>
      <p className="text-zinc-500 text-sm mb-8">오늘도 안심하고 상담하세요.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="이번 달 상담" value="0건" />
        <StatCard label="남은 상담 시간" value="—" />
        <StatCard label="AI 요약 전송" value="0건" />
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center">
        <p className="text-zinc-400 text-sm">통화방 기능은 Milestone 3에서 추가됩니다.</p>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 px-6 py-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
    </div>
  )
}
