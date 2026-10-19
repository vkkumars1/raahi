'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Copy, LoaderCircle, MessageCircle, RotateCcw, Send, Square, X } from 'lucide-react'
import { chatWithAi, searchRides, warmupAi } from '@/lib/api'
import { useAssistantStore, type AssistantMessage, type AssistantRide } from '@/lib/assistant-store'
import { useUserStore } from '@/lib/user-store'
import { cn } from '@/lib/utils'

const quickReplies = ['Find a ride to office', 'How is my fare calculated?', 'Safety tips']
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const localReplies: Record<string, string> = {
  'find a ride to office': 'I am checking nearby NCR corporate routes and will show the best available seats for your time.',
  'how is my fare calculated?': 'Your share is based on the route distance multiplied by the host\'s per-kilometre rate. No surge and no hidden charges.',
  'safety tips': 'Check the host\'s verified profile, choose a public pickup point, and share your ride details with someone you trust. Travel safely!',
}

function localRideCards(): AssistantRide[] {
  return [
    { id: 'demo-ride', origin: 'Rajiv Chowk, Gurugram', destination: 'Cyber City', departTime: '08:30', fare: 81, seats: 2 },
    { id: 'demo-ride-2', origin: 'Noida Sector 62', destination: 'Okhla Phase III', departTime: '09:00', fare: 49, seats: 1 },
    { id: 'demo-ride-3', origin: 'Dwarka Sector 21', destination: 'Connaught Place', departTime: '08:15', fare: 60, seats: 3 },
  ]
}

function extractRides(text: string): AssistantRide[] | undefined {
  const match = text.match(/\{[\s\S]*?"type"\s*:\s*"rides"[\s\S]*?\}/)
  if (!match) return undefined
  try {
    const parsed = JSON.parse(match[0]) as { rides?: AssistantRide[] }
    return parsed.rides?.filter((ride) => ride.id && ride.origin && ride.destination)
  } catch {
    return undefined
  }
}

export function RaahiSathi() {
  const reducedMotion = useReducedMotion()
  const { open, warmed, messages, setOpen, setWarmed, addMessage, updateMessage } = useAssistantStore()
  const user = useUserStore((state) => state.user)
  const displayName = user?.name?.split(' ')[0] || 'there'
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AssistantRide[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }) }, [messages, generating, reducedMotion])

  useEffect(() => {
    if (!open || !user || suggestions.length || loadingSuggestions) return
    setLoadingSuggestions(true)
    void searchRides({ pickupLat: 28.6139, pickupLng: 77.209, dropLat: 28.4595, dropLng: 77.0266, time: '08:30', windowMinutes: 60 })
      .then((rides) => setSuggestions(rides.slice(0, 3).map((ride) => ({ id: ride.id, origin: ride.origin, destination: ride.destination, departTime: ride.departTime, fare: Math.round((ride.distanceKm ?? 0) * ride.pricePerKm / 2), seats: ride.availableSeats ?? ride.seats }))))
      .catch(() => setSuggestions(localRideCards()))
      .finally(() => setLoadingSuggestions(false))
  }, [open, suggestions.length, loadingSuggestions])

  useEffect(() => {
    if (open && !warmed) {
      setWarmed()
      void warmupAi()
    }
  }, [open, warmed, setWarmed])

  async function sendMessage(value = input) {
    const text = value.trim()
    if (!text || generating) return
    setInput('')
    if (!user) {
      addMessage({ id: id(), role: 'assistant', content: 'Please sign in first so I can show rides matched to your account and keep your commute details secure.', status: 'sent' })
      return
    }
    setError(null)
    const userId = id()
    const assistantId = id()
    addMessage({ id: userId, role: 'user', content: text, status: 'sent' })
    addMessage({ id: assistantId, role: 'assistant', content: '', status: 'streaming' })
    setGenerating(true)
    const controller = new AbortController()
    abortRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 60000)

    try {
      if (!process.env.NEXT_PUBLIC_API_URL) {
        const normalized = text.toLowerCase()
        const isRideRequest = normalized.includes('ride') || normalized.includes('office')
        const localContent = localReplies[normalized] ?? `I understand, ${displayName}. I can help you find a verified NCR ride, explain your fare, or share practical safety tips.`
        await new Promise((resolve) => window.setTimeout(resolve, 420))
        updateMessage(assistantId, { content: localContent, rides: isRideRequest ? suggestions.length ? suggestions : localRideCards() : undefined, status: 'sent' })
        return
      }
      const response = await chatWithAi(text, controller.signal)
      if (!response.body) throw new Error('No stream')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let content = ''
      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        content += decoder.decode(chunk, { stream: true })
        updateMessage(assistantId, { content, rides: extractRides(content) })
      }
      updateMessage(assistantId, { content, rides: extractRides(content), status: 'sent' })
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') {
        setError('The assistant is taking longer than expected. Please try again.')
        updateMessage(assistantId, { content: 'Sorry, I could not get a response right now.', status: 'error' })
      } else if (controller.signal.aborted) {
        updateMessage(assistantId, { status: 'sent' })
      }
    } finally {
      window.clearTimeout(timeout)
      abortRef.current = null
      setGenerating(false)
    }
  }

  function retry() {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user')
    if (lastUser) void sendMessage(lastUser.content)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      <AnimatePresence>
      {open && (
        <motion.section initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 28 }} aria-label="Raahi Sathi assistant" className="w-[min(calc(100vw-2rem),380px)] overflow-hidden border-2 border-ink bg-cream shadow-[7px_7px_0_var(--ink)]">
          <header className="flex items-center justify-between border-b-2 border-ink bg-saffron px-4 py-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.2em]">Raahi Sathi</p><p className="font-fraunces text-lg leading-none">Your commute assistant</p></div>
            <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-ink/10"><X size={18} /></button>
          </header>
          <div className="flex max-h-[min(55vh,470px)] flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && <div className="border border-dashed border-ink/40 p-3 text-sm">Hello{user?.name ? ` ${displayName}` : ''}. {user ? 'I can help you find a verified NCR ride, understand your fare, or share safety tips.' : <>Please <Link className="font-semibold text-brick underline" href="/login">sign in</Link> to find rides and get personalised help.</>}</div>}
            {messages.map((message) => <Message key={message.id} message={message} />)}
            {loadingSuggestions && <div className="flex items-center gap-2 border border-dashed border-ink/30 p-3 text-xs text-ink/60"><LoaderCircle className="animate-spin" size={14} /> Checking nearby NCR rides...</div>}
            {!loadingSuggestions && suggestions.length > 0 && messages.length === 0 && <div className="flex flex-col gap-2"><p className="font-mono text-[10px] uppercase tracking-wider text-ink/60">Nearby NCR matches</p>{suggestions.map((ride) => <Link key={ride.id} href={`/rides/${ride.id}`} className="border border-ink/40 bg-cream p-2 text-xs transition-transform hover:-translate-y-0.5 hover:bg-saffron"><div className="flex justify-between font-mono text-[10px]"><span>{ride.departTime}</span><span>₹{ride.fare} · {ride.seats} seats</span></div><div className="font-semibold">{ride.origin} ��� {ride.destination}</div></Link>)}</div>}
            {!warmed && <p className="flex items-center gap-2 text-xs text-ink/60"><LoaderCircle className="animate-spin" size={14} /> Waking up the assistant...</p>}
            {generating && <button type="button" onClick={() => abortRef.current?.abort()} className="mx-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider"><Square size={12} /> Stop generating</button>}
            {error && <div className="flex items-center justify-between gap-3 border border-brick bg-brick/10 p-2 text-xs"><span>{error}</span><button type="button" onClick={retry} className="flex items-center gap-1 font-mono uppercase"><RotateCcw size={12} /> Retry</button></div>}
            <div ref={endRef} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-ink/20 px-4 py-3">{quickReplies.map((reply) => <button key={reply} type="button" onClick={() => void sendMessage(reply)} className="border border-ink/50 px-2 py-1 text-[11px] hover:bg-saffron">{reply}</button>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); void sendMessage() }} className="flex gap-2 border-t-2 border-ink p-3">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void sendMessage() } }} rows={1} aria-label="Message Raahi Sathi" placeholder="Ask about a ride, fare, or safety..." className="min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none" />
            <button type="submit" aria-label="Send message" disabled={!input.trim() || generating} className="border-2 border-ink bg-saffron p-2 shadow-[3px_3px_0_var(--ink)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-40"><Send size={16} /></button>
          </form>
        </motion.section>
      )}
      </AnimatePresence>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 border-2 border-ink bg-saffron px-4 py-3 font-fraunces text-lg shadow-[5px_5px_0_var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-x-[5px] active:translate-y-[5px] active:shadow-none"><MessageCircle size={18} /> Sathi</button>
    </div>
  )
}

function Message({ message }: { message: AssistantMessage }) {
  return <div className={cn('max-w-[88%] self-start', message.role === 'user' && 'self-end')}>
    <div className={cn('relative border border-ink/20 p-3 text-sm', message.role === 'user' ? 'bg-saffron' : 'bg-cream')}>
      <p className="whitespace-pre-wrap">{message.content || '...'}</p>
      {message.role === 'assistant' && message.content && <button type="button" aria-label="Copy response" onClick={() => void navigator.clipboard?.writeText(message.content)} className="mt-2 text-ink/50 hover:text-ink"><Copy size={13} /></button>}
    </div>
    {message.rides && <div className="mt-2 flex flex-col gap-2">{message.rides.map((ride) => <Link key={ride.id} href={`/rides/${ride.id}`} className="block border-2 border-ink bg-cream p-2 text-xs shadow-[3px_3px_0_var(--ink)] hover:bg-saffron"><div className="font-mono text-[10px]">{ride.departTime}</div><div className="font-semibold">{ride.origin} → {ride.destination}</div>{ride.fare != null && <div className="font-mono">₹{ride.fare} <span className="font-sans text-[10px]">your share</span></div>}</Link>)}</div>}
  </div>
}
