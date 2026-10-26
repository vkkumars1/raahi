import { cookies } from 'next/headers'

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''

export async function apiServer(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get('raahi_session')?.value
  return fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

export async function apiServerJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> {
  const response = await apiServer(path, init)
  if (!response.ok) return null
  return response.json() as Promise<T>
}
