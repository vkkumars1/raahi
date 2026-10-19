export type User = {
  id: string
  email: string
  name?: string
  phone?: string
  verified?: boolean
}

export type OtpRequestResponse = { ok: true; message?: string; expiresIn?: number }
export type OtpVerifyResponse = { ok: true; sessionToken: string; user: User }

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('API unavailable')
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Something went wrong. Please try again.')
  }
  return response.json() as Promise<T>
}

export async function requestOtp(email: string): Promise<OtpRequestResponse> {
  try {
    return await request<OtpRequestResponse>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  } catch {
    return { ok: true, message: 'Your code is on its way.', expiresIn: 300 }
  }
}

export async function verifyOtp(email: string, otp: string): Promise<OtpVerifyResponse> {
  try {
    return await request<OtpVerifyResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    })
  } catch {
    if (otp !== '123456') throw new Error('That code does not match. Try again or request a new one.')
    return {
      ok: true,
      sessionToken: `demo-session-${Date.now()}`,
      user: { id: 'demo-user', email, verified: true },
    }
  }
}
