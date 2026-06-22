import { Suspense } from 'react'
import LoginContent from './LoginContent'

export const metadata = { title: '로그인 — 클린에듀' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">클린에듀</h1>
          <p className="mt-2 text-sm text-zinc-500">교사를 위한 안심 상담 서비스</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8">
          <h2 className="text-lg font-semibold text-zinc-800 mb-6 text-center">
            교사 로그인
          </h2>

          <Suspense>
            <LoginContent />
          </Suspense>

          <a
            href="/api/auth/kakao"
            className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#FEE500] text-zinc-900 font-semibold py-3.5 text-sm hover:bg-[#F5DC00] transition-colors"
          >
            <KakaoIcon />
            카카오 로그인
          </a>

          <p className="mt-6 text-center text-xs text-zinc-400">
            로그인 시{' '}
            <span className="underline cursor-pointer">이용약관</span>에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 1C4.582 1 1 3.79 1 7.225c0 2.178 1.452 4.09 3.638 5.186l-.928 3.458c-.08.301.272.541.536.363L8.37 13.8c.207.02.416.031.63.031 4.418 0 8-2.79 8-6.225C17 3.79 13.418 1 9 1z"
        fill="#3A1D1D"
      />
    </svg>
  )
}
