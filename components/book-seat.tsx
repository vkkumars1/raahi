'use client'

import { useState, useTransition } from 'react'
import { createBooking } from '@/app/rides/[id]/actions'
import type { Place } from '@/lib/api'

export function BookSeat({
  rideId,
  pickup,
  drop,
}: {
  rideId: string
  pickup: Place
  drop: Place
}) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function submit() {
    startTransition(async () => {
      const result = await createBooking(rideId, pickup, drop)
      if (result.ok) {
        setState('success')
        setMessage('Seat held. See you on the road.')
      } else {
        setState('error')
        setMessage(result.message)
      }
    })
  }

  if (state === 'success')
    return (
      <div className="border-2 border-ink bg-saffron p-5 font-mono text-sm shadow-[4px_4px_0_#14110F]">
        {message}
      </div>
    )

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="w-full bg-saffron px-5 py-4 font-mono text-sm uppercase tracking-widest text-ink shadow-[4px_4px_0_#14110F] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? 'Holding your seat…' : `Book seat (${pickup.label} → ${drop.label})`}
      </button>
      {state === 'error' && (
        <p role="alert" className="border border-brick bg-brick/10 p-3 text-sm text-brick">
          {message}
        </p>
      )}
    </div>
  )
}
