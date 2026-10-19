'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, RefreshCw } from 'lucide-react'
import { requestOtp, verifyOtp } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { Button } from '@/components/ui/button'

const emailSchema = z.string().trim().email('Enter a valid email address.')
const OTP_LENGTH = 6

export function LoginForm({ nextPath = '/dashboard' }: { nextPath?: string }) {
  const router = useRouter()
  const setUser = useUserStore((state) => state.setUser)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [isLoading, setIsLoading] = useState(false)
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (step !== 'otp' || secondsLeft === 0) return
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [step, secondsLeft])

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address.')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const result = await requestOtp(parsed.data)
      setEmail(parsed.data)
      setStep('otp')
      setSecondsLeft(30)
      setNotice(result.message ?? 'Your six-digit code is on its way.')
      window.setTimeout(() => inputs.current[0]?.focus(), 50)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send your code.')
    } finally {
      setIsLoading(false)
    }
  }

  const updateOtp = (index: number, value: string) => {
    setError('')
    const digits = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digits
    setOtp(next)
    if (digits && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((digit, index) => { next[index] = digit })
    setOtp(next)
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) inputs.current[index - 1]?.focus()
  }

  const confirmCode = async (event: React.FormEvent) => {
    event.preventDefault()
    const code = otp.join('')
    if (code.length !== OTP_LENGTH) {
      setError('Enter all six digits to continue.')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const result = await verifyOtp(email, code)
      const session = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) })
      if (!session.ok) throw new Error('Could not save your session. Please try again.')
      setUser(result.user)
      router.replace(nextPath || '/dashboard')
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'That code did not work.')
      setOtp(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const resend = async () => {
    if (secondsLeft > 0 || isLoading) return
    setIsLoading(true)
    setError('')
    try {
      await requestOtp(email)
      setSecondsLeft(30)
      setNotice('A fresh code is on its way.')
      setOtp(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } catch {
      setError('Could not resend your code. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-8">
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="/" className="font-heading text-2xl font-semibold tracking-tight">raahi<span className="text-brick">.</span></a>
        <span className="eyebrow">Verified commuter network</span>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-120px)] max-w-7xl items-center gap-12 py-14 lg:grid-cols-[1fr_460px] lg:gap-24">
        <section className="hidden lg:block">
          <p className="eyebrow mb-6 text-brick">A better way home</p>
          <h1 className="max-w-xl text-[clamp(4.5rem,9vw,9rem)] font-semibold leading-[.84] tracking-[-.06em]">Come as you are.<br /><span className="text-brick">Go together.</span></h1>
          <div className="mt-16 flex max-w-md items-center gap-5 text-sm leading-relaxed">
            <div className="road-lane max-w-20" />
            <p>One verified ride can turn a long commute into a familiar face, a fair fare, and a little more city.</p>
          </div>
        </section>
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="ticket-stub p-7 shadow-[8px_8px_0_var(--color-ink)] md:p-10">
          <div className="mb-10 flex items-start justify-between">
            <div>
              <p className="eyebrow mb-3 text-brick">Welcome to raahi</p>
              <h2 className="text-4xl font-semibold leading-none">{step === 'email' ? 'Let\'s get you moving.' : 'Check your inbox.'}</h2>
            </div>
            <div className="font-mono text-xs">{step === 'email' ? '01 / 02' : '02 / 02'}</div>
          </div>
          {step === 'email' ? (
            <form onSubmit={sendCode} className="flex flex-col gap-5" noValidate>
              <label className="flex flex-col gap-2"><span className="input-label">Your email</span><span className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brick" size={17} /><input autoFocus value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} className="input-rail pl-10" type="email" placeholder="you@workplace.com" aria-invalid={Boolean(error)} /></span></label>
              {error && <p className="font-mono text-xs text-brick" role="alert">{error}</p>}
              <Button type="submit" variant="primary" className="mt-3 w-full justify-between" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <>Send me a code <ArrowRight /></>}</Button>
              <p className="font-mono text-[10px] leading-relaxed text-ink/60">By continuing, you agree to Raahi&apos;s community guidelines and ride safe promise.</p>
            </form>
          ) : (
            <form onSubmit={confirmCode} className="flex flex-col gap-5" noValidate>
              <p className="text-sm leading-relaxed">We sent a six-digit code to <strong>{email}</strong>. Enter it below to verify your ride account.</p>
              <div className="flex gap-2 md:gap-3" onPaste={handlePaste}>
                {otp.map((digit, index) => <input key={index} ref={(element) => { inputs.current[index] = element }} value={digit} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => handleKeyDown(index, event)} inputMode="numeric" maxLength={1} aria-label={`OTP digit ${index + 1}`} className="size-11 border-[1.5px] border-ink bg-white text-center font-mono text-lg outline-none transition-shadow focus:border-brick focus:shadow-[3px_3px_0_var(--color-saffron)] md:size-12" />)}
              </div>
              {notice && !error && <p className="font-mono text-xs text-ink/60" role="status"><Check className="mr-1 inline" size={13} />{notice}</p>}
              {error && <p className="font-mono text-xs text-brick" role="alert">{error}</p>}
              <Button type="submit" variant="primary" className="mt-2 w-full justify-between" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <>Verify & enter <ArrowRight /></>}</Button>
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[.08em]"><button type="button" onClick={() => { setStep('email'); setError('') }} className="inline-flex items-center gap-1 underline-offset-4 hover:underline"><ArrowLeft size={13} /> Change email</button><button type="button" onClick={resend} disabled={secondsLeft > 0 || isLoading} className="inline-flex items-center gap-1 disabled:opacity-40"><RefreshCw size={13} /> {secondsLeft > 0 ? `Resend in 00:${String(secondsLeft).padStart(2, '0')}` : 'Resend code'}</button></div>
            </form>
          )}
        </motion.section>
      </div>
    </main>
  )
}
