import Link from 'next/link'

export const dynamic = 'force-dynamic'
import { getRide } from '@/lib/api'
import { BookSeat } from '@/components/book-seat'
import { RideChat } from '@/components/ride-chat'
import { getRideMessages } from '@/lib/api'
import { RideMapDynamic } from '@/components/ride-map-dynamic'

export default async function RideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [ride, messages] = await Promise.all([getRide(id), getRideMessages(id)])
  const participants = [{ id: ride.driver?.id ?? 'demo-user', name: ride.driver?.name ?? 'Host', initial: (ride.driver?.name ?? 'H').charAt(0) }]
  return <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8"><Link href="/find" className="font-mono text-xs uppercase tracking-widest text-brick">← Back to rides</Link><div className="mt-7 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]"><section><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brick">Ride details · {ride.departTime}</p><h1 className="mt-3 font-serif text-5xl leading-none md:text-7xl">{ride.origin}<br /><em>to {ride.destination}</em></h1><div className="ticket-stub mt-8"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-widest text-ink/55">Your host</p><h2 className="mt-2 font-serif text-3xl">{ride.driver?.name ?? 'Raahi host'}</h2><p className="mt-1 text-sm text-ink/60">{ride.driver?.verified ? 'Verified commuter · Trust score 4.9/5' : 'Community commuter'}</p></div><div className="rounded-full bg-brick px-3 py-2 font-mono text-xs text-cream">{ride.driver?.verified ? '✓ VERIFIED' : 'HOST'}</div></div><div className="my-6 grid grid-cols-2 gap-4 border-y border-dashed border-ink/25 py-5 font-mono text-sm"><span>DEPART<br /><strong className="text-xl">{ride.departTime}</strong></span><span>SEATS LEFT<br /><strong className="text-xl">{ride.availableSeats ?? ride.seats}</strong></span><span>ROUTE<br /><strong className="text-xl">{ride.distanceKm ?? '—'} km</strong></span><span>YOUR SHARE<br /><strong className="text-xl">₹{Math.round((ride.pricePerKm * (ride.distanceKm ?? 0)) / 2)}</strong></span></div><BookSeat rideId={ride.id} origin={ride.origin} destination={ride.destination} /><details className="mt-5 border-t border-dashed border-ink/30 pt-5"><summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-brick">Open group chat</summary><div className="mt-4 h-[520px] overflow-hidden border-2 border-ink"><RideChat rideId={ride.id} initialMessages={messages} participants={participants} /></div></details></div></section><aside className="order-first h-[420px] overflow-hidden border-2 border-ink lg:order-none lg:h-[620px]"><RideMapDynamic route={[]} /></aside></div></main>
}
