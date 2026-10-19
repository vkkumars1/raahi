'use client'

import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import type { Message } from '@/lib/api'

type ChatState = {
  socket: Socket | null
  messages: Message[]
  connected: boolean
  typingName: string | null
  setMessages: (messages: Message[]) => void
  connect: (rideId: string) => void
  disconnect: () => void
  send: (rideId: string, text: string, senderId: string) => Promise<void>
  setTyping: (rideId: string, name: string) => void
}

let sharedSocket: Socket | null = null
let typingTimer: ReturnType<typeof setTimeout> | null = null

export const useChatStore = create<ChatState>((set, get) => ({
  socket: null,
  messages: [],
  connected: false,
  typingName: null,
  setMessages: (messages) => set({ messages }),
  connect: (rideId) => {
    if (!sharedSocket) {
      sharedSocket = io(process.env.NEXT_PUBLIC_API_URL || window.location.origin, { withCredentials: true, autoConnect: true })
      sharedSocket.on('connect', () => set({ connected: true }))
      sharedSocket.on('disconnect', () => set({ connected: false }))
      sharedSocket.on('message', (message: Message) => set((state) => ({ messages: state.messages.some((item) => item.id === message.id) ? state.messages : [...state.messages, message] })))
      sharedSocket.on('typing', ({ name }: { name: string }) => {
        set({ typingName: name })
        if (typingTimer) clearTimeout(typingTimer)
        typingTimer = setTimeout(() => set({ typingName: null }), 1500)
      })
    }
    sharedSocket.emit('join_ride', { rideId })
    set({ socket: sharedSocket })
  },
  disconnect: () => {
    sharedSocket?.off('message')
    sharedSocket?.off('typing')
    set({ socket: sharedSocket, typingName: null })
  },
  send: async (rideId, text, senderId) => {
    const socket = get().socket
    if (!socket) throw new Error('Chat is reconnecting')
    await new Promise<void>((resolve, reject) => {
      socket.timeout(7000).emit('message', { rideId, text, senderId }, (error: Error | null) => error ? reject(error) : resolve())
    })
  },
  setTyping: (rideId, name) => get().socket?.emit('typing', { rideId, name }),
}))
