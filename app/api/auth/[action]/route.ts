import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params

  if (action === 'verify-otp') {
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

  if (action === 'socket-token') {
    const token = (await cookies()).get('raahi_session')?.value
    if (!token) return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
    const upstream = await fetch(`${API}/auth/socket-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await upstream.json().catch(() => ({}))
    return NextResponse.json(data, { status: upstream.status })
  }

  if (action === 'logout') {
    const jar = await cookies()
    const token = jar.get('raahi_session')?.value
    if (token) {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined)
    }
    jar.delete('raahi_session')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'not found', code: 'not_found' }, { status: 404 })
}
