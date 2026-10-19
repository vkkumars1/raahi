'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, RotateCcw, X } from 'lucide-react'
import type { Message } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { useChatStore } from '@/lib/chat-store'
import { cn } from '@/lib/utils'

type Participant = { id: string; name: string; initial: string }

type RideChatProps = { rideId: string; initialMessages: Message[]; participants?: Participant[]; onClose?: () => void; fullPage?: boolean }

export function RideChat({ rideId, initialMessages, participants = [], onClose, fullPage = false }: RideChatProps) {
  const user = useUserStore((state) => state.user)
  const { messages, setMessages, connect, disconnect, connected, typingName, send, setTyping } = useChatStore()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)

  useEffect(() => { setMessages(initialMessages); connect(rideId); return () => disconnect() }, [connect, disconnect, initialMessages, rideId, setMessages])
  useEffect(() => { if (nearBottom.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; else if (messages.length > initialMessages.length) setNewCount((count) => count + 1) }, [messages.length, initialMessages.length])

  function onScroll() { const element = scrollRef.current; if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72 }
  function submit(event: React.FormEvent) { event.preventDefault(); const text = draft.trim(); if (!text || sending) return; const id = `local-${Date.now()}`; const message: Message = { id, rideId, senderId: user?.id ?? 'demo-user', text, createdAt: new Date().toISOString() }; setMessages([...messages, message]); setDraft(''); setSending(id); setFailed(null); send(rideId, text, message.senderId).then(() => setSending(null)).catch(() => { setSending(null); setFailed(id) }) }
  function retry(message: Message) { setFailed(null); setSending(message.id); send(rideId, message.text, message.senderId).then(() => setSending(null)).catch(() => { setSending(null); setFailed(message.id) }) }

  return <section className={cn('flex min-h-0 flex-col bg-cream', fullPage ? 'h-[calc(100vh-5rem)]' : 'h-full')} aria-label="Ride group chat">
    <header className="border-b-2 border-ink bg-cream px-5 py-4"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brick">Ride group chat</p><h2 className="mt-1 font-serif text-2xl">The daily commute</h2></div>{onClose && <button onClick={onClose} className="rounded-full border border-ink p-2" aria-label="Close chat"><X /></button>}</div><div className="mt-4 flex gap-2" aria-label="Participants">{participants.map((person) => <div key={person.id} title={person.name} className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-saffron font-serif text-lg">{person.initial}</div>)}</div></header>
    {!connected && <div className="border-b border-ink/20 bg-ink px-5 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-cream">reconnecting...</div>}
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite"> <div className="flex flex-col gap-3">{messages.map((message) => { const own = message.senderId === (user?.id ?? 'demo-user'); const participant = participants.find((person) => person.id === message.senderId); return <div key={message.id} className={cn('flex max-w-[84%] flex-col gap-1', own ? 'ml-auto items-end' : 'items-start')}><div className={cn('paper-note px-4 py-3', own ? 'bg-saffron' : 'border border-ink bg-cream')}><p className="font-sans text-sm">{!own && <strong className="mr-2">{participant?.name ?? 'Raahi'}</strong>}{message.text}</p><div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-ink/60"><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{sending === message.id && <span>sending</span>}{failed === message.id && <button onClick={() => retry(message)} className="inline-flex items-center gap-1 text-brick"><RotateCcw /> retry</button>}</div></div></div> })}</div>{typingName && <p className="mt-4 font-sans text-xs italic text-ink/60">{typingName} is typing<span className="typing-dots">...</span></p>}</div>
    {newCount > 0 && <button onClick={() => { setNewCount(0); nearBottom.current = true; if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }} className="mx-auto -mt-12 mb-3 rounded-full border border-ink bg-saffron px-4 py-2 font-mono text-[10px] uppercase tracking-widest">{newCount} new messages</button>}
    <form onSubmit={submit} className="border-t-2 border-ink bg-cream p-4"><textarea value={draft} onChange={(event) => { setDraft(event.target.value); setTyping(rideId, user?.name ?? 'A raahi') }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Write to the group..." rows={2} className="w-full resize-none border-2 border-ink bg-cream p-3 font-sans text-sm outline-none placeholder:text-ink/40 focus:border-brick" aria-label="Message" /><button disabled={!draft.trim() || Boolean(sending)} className="button-primary mt-3 w-full justify-center"><Send /> Send message</button></form>
  </section>
}
