'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export function FindAuthGate() {
  return (
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-5 py-10 md:px-8 md:py-16">
      <div aria-hidden="true" className="pointer-events-none mx-auto max-w-7xl select-none blur-[7px] opacity-45">
        <div className="mb-8 h-28 border-2 border-ink/30 bg-cream" />
        <div className="grid gap-5 lg:grid-cols-2">
          {[1, 2, 3].map((item) => <div key={item} className="ticket-stub h-56" />)}
        </div>
      </div>
      <div className="absolute inset-0 grid place-items-center bg-cream/60 px-5">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="ticket-stub max-w-md bg-saffron p-7 text-center shadow-[6px_6px_0_#14110F]">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Private commuter network</p>
          <h1 className="mt-3 font-serif text-4xl leading-none">Login karke rides dekho.</h1>
          <p className="mt-4 text-sm leading-6 text-ink/70">Verified matches aur real-time seats sirf logged-in raahis ke liye hain.</p>
          <Link href="/login?next=%2Ffind" className="mt-6 inline-flex border-2 border-ink bg-cream px-5 py-3 font-mono text-xs uppercase tracking-[0.12em] shadow-[4px_4px_0_#14110F] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none">Login now</Link>
        </motion.section>
      </div>
    </main>
  )
}
