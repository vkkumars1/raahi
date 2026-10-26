import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body', code: 'invalid_body' }, { status: 400 })

  const upstream = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await upstream.json().catch(() => ({}))
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status })

  const token = (data as { token?: string }).token
  if (token) {
    ;(await cookies()).set('raahi_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    })
  }
  const { token: _omit, ...safe } = data as Record<string, unknown>
  return NextResponse.json(safe)
}
