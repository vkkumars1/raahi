import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''

export async function POST() {
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
