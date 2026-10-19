'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Ride } from '@/lib/api'

const RideMap = dynamic(() => import('@/components/ride-map').then((mod) => mod.RideMap), { ssr: false, loading: () => <div className="h-full min-h-[520px] animate-pulse bg-[#e8dfd0]" /> })

function coordinates(ride: Ride) {
  const geometry = ride.routeGeoJSON as { geometry?: { coordinates?: [number, number][] }; coordinates?: [number, number][] } | undefined
  const points = geometry?.geometry?.coordinates ?? geometry?.coordinates ?? []
  return points.map(([lng, lat]) => ({ lat, lng }))
}

function score(ride: Ride) { return Math.min(98, Math.max(64, Math.round((ride.availableSeats ?? 1) * 9 + (ride.driver?.verified ? 72 : 58)))) }

export function FindResults({ rides, initialPickup, initialDrop, initialTime }: { rides: Ride[]; initialPickup?: string; initialDrop?: string; initialTime?: string }) {
  const [selected, setSelected] = useState(rides[0]?.id)
  const selectedRide = rides.find((ride) => ride.id === selected) ?? rides[0]
  const selectedRoute = useMemo(() => selectedRide ? coordinates(selectedRide) : [], [selectedRide])
  const params = new URLSearchParams({ pickup: initialPickup ?? '', drop: initialDrop ?? '', time: initialTime ?? '' })
  return <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8">
    <header className="mb-8 flex flex-col gap-5 border-b border-ink/20 pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brick">Find a ride</p><h1 className="mt-2 font-serif text-5xl leading-none md:text-7xl">Your seat is<br /><em>waiting.</em></h1></div>
      <form action="/find" className="grid w-full gap-2 rounded-sm border-2 border-ink bg-cream p-3 shadow-[4px_4px_0_#14110F] lg:max-w-2xl lg:grid-cols-[1fr_1fr_150px_110px_auto]">
        <label className="sr-only" htmlFor="pickup">Pickup</label><input id="pickup" name="pickup" defaultValue={initialPickup} placeholder="Pickup area" className="border-b border-ink/30 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink/45" />
        <label className="sr-only" htmlFor="drop">Drop</label><input id="drop" name="drop" defaultValue={initialDrop} placeholder="Drop area" className="border-b border-ink/30 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink/45" />
        <input type="time" name="time" defaultValue={initialTime} className="border-b border-ink/30 bg-transparent px-2 py-2 font-mono text-sm outline-none" />
        <select name="windowMinutes" defaultValue="30" className="border-b border-ink/30 bg-transparent px-2 py-2 font-mono text-xs outline-none"><option value="15">±15 min</option><option value="30">±30 min</option><option value="60">±60 min</option></select>
        <button className="bg-saffron px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink shadow-[3px_3px_0_#14110F] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none" type="submit">Search</button>
      </form>
    </header>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section aria-label="Available rides" className="flex flex-col gap-4">
        <div className="flex items-center justify-between"><p className="font-mono text-xs uppercase tracking-[0.16em] text-ink/60">{rides.length} rides found</p><span className="font-mono text-xs text-ink/50">Sorted by match</span></div>
        {rides.length === 0 ? <div className="ticket-stub flex min-h-72 flex-col items-center justify-center px-8 text-center"><div className="mb-4 text-6xl text-brick">⌁</div><h2 className="font-serif text-3xl">No rides on this route yet</h2><p className="mt-2 max-w-sm text-sm text-ink/60">Try widening your time window, or check back when your city wakes up.</p></div> : rides.map((ride) => { const match = score(ride); const active = ride.id === selected; return <button key={ride.id} type="button" onMouseEnter={() => setSelected(ride.id)} onFocus={() => setSelected(ride.id)} onClick={() => { window.location.href = `/rides/${ride.id}` }} className={`ticket-stub w-full text-left transition-transform hover:-translate-y-1 ${active ? 'ring-2 ring-brick ring-offset-2 ring-offset-cream' : ''}`}><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="font-serif text-2xl">{ride.driver?.name ?? 'Raahi host'}</span>{ride.driver?.verified && <span className="inline-flex size-5 items-center justify-center rounded-full bg-brick text-xs text-cream" aria-label="Verified host">✓</span>}</div><p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">{ride.driver?.verified ? 'Verified commuter' : 'Community host'} · {match}% match</p></div><div className="relative grid size-16 place-items-center rounded-full border-[5px] border-saffron font-mono text-xs after:absolute after:inset-1 after:rounded-full after:border after:border-dashed after:border-ink/25">{match}%</div></div><div className="my-5 flex items-center gap-3 border-y border-dashed border-ink/25 py-3"><span className="font-mono text-xl">{ride.departTime}</span><span className="h-px flex-1 bg-ink/25" /><span className="max-w-[45%] truncate text-sm">{ride.origin} → {ride.destination}</span></div><div className="flex flex-wrap items-end justify-between gap-3"><span className="font-mono text-xs text-ink/60">{ride.availableSeats ?? ride.seats} seats left · {ride.distanceKm ?? 0} km detour</span><span className="text-right"><strong className="block font-mono text-xl">₹{Math.round((ride.pricePerKm * (ride.distanceKm ?? 0)) / 2)}</strong><small className="font-mono text-[10px] uppercase tracking-widest text-ink/50">your share</small></span></div></button> })}
      </section>
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] overflow-hidden border-2 border-ink lg:block"><RideMap route={selectedRoute} /></aside>
    </div>
  </div>
}
