import type { Metadata } from 'next'
import { LoginForm } from '@/components/login-form'

export const metadata: Metadata = {
  title: 'Sign in — Raahi',
  description: 'Sign in to your verified Raahi commuter account.',
}

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const nextPath = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/dashboard'
  return <LoginForm nextPath={nextPath} />
}
