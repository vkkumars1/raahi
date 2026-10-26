import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''

export async function POST() {
  const token = (await cookies()).get('raahi_session')?.value
  if (!token) return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
  const upstream = await fetch(`${API}/auth/socket-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
