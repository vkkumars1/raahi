import { NextResponse } from 'next/server'
import type { User } from '@/lib/api'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { sessionToken?: string; user?: User } | null
  if (!body?.sessionToken || !body.user?.id) {
    return NextResponse.json({ message: 'Invalid session.' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true, user: body.user })
  response.cookies.set('raahi_session', body.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
