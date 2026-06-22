import { redirect } from 'next/navigation'
import { getTokenFromCookies } from '@/lib/session/cookie'
import { verifySession } from '@/lib/session/jwt'

export default async function RootPage() {
  const token = await getTokenFromCookies()
  const session = token ? await verifySession(token) : null
  redirect(session ? '/dashboard' : '/login')
}
