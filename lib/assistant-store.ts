'use client'

import { create } from 'zustand'

export type AssistantRide = {
  id: string
  origin: string
  destination: string
  departTime: string
  fare?: number
  seats?: number
}

export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  rides?: AssistantRide[]
  status?: 'sending' | 'streaming' | 'sent' | 'error'
}

type AssistantState = {
  open: boolean
  warmed: boolean
  messages: AssistantMessage[]
  setOpen: (open: boolean) => void
  setWarmed: () => void
  addMessage: (message: AssistantMessage) => void
  updateMessage: (id: string, update: Partial<AssistantMessage>) => void
  clear: () => void
}

export const useAssistantStore = create<AssistantState>((set) => ({
  open: false,
  warmed: false,
  messages: [],
  setOpen: (open) => set({ open }),
  setWarmed: () => set({ warmed: true }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, update) => set((state) => ({ messages: state.messages.map((message) => message.id === id ? { ...message, ...update } : message) })),
  clear: () => set({ messages: [] }),
}))
