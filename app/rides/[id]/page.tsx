import Link from 'next/link'
import { getRide, getRideMessages, type Ride, type Message } from '@/lib/api'
import { BookSeat } from '@/components/book-seat'
import { RideChat } from '@/components/ride-chat'
import { RideMapDynamic } from '@/components/ride-map-dynamic'

export const dynamic = 'force-dynamic'

type Pt = { lat: number; lng: number }

function routeCoords(ride: Ride): Pt[] {
  const g = ride.routeGeoJSON as { geometry?: { coordinates?: [number, number][] }; coordinates?: [number, number][] } | undefined
  const pts = g?.geometry?.coordinates ?? g?.coordinates ?? []
  if (pts.length >= 2) return pts.map(([lng, lat]) => ({ lat, lng }))
  return [
    { lat: ride.originPlace.lat, lng: ride.originPlace.lng },
    { lat: ride.destinationPlace.lat, lng: ride.destinationPlace.lng },
  ]
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

export default async function RideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let ride: Ride | null = null
  try {
    ride = await getRide(id)
  } catch {
    ride = null
  }

  if (!ride) {
    return (
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-16 text-center">
        <h1 className="font-serif text-4xl">Ride not found</h1>
        <p className="mt-3 text-ink/60">This ride may have been completed or cancelled.</p>
        <Link href="/find" className="mt-6 inline-block border-2 border-ink bg-saffron px-5 py-3 font-mono text-xs uppercase tracking-widest shadow-[3px_3px_0_#14110F]">Back to find</Link>
      </main>
    )
  }

  let messages: Message[] = []
  if (ride.isHost || ride.myBooking) {
    try {
      messages = await getRideMessages(id)
    } catch {
      messages = []
    }
  }

  const seatsLeft = ride.seatsLeft ?? ride.availableSeats ?? ride.seats
  const totalKm = ride.distanceKm ?? ride.segmentKm ?? 0
  const estimatedFare = ride.fare ?? Math.max(10, Math.round(ride.pricePerKm * totalKm))
  const participants = (ride.participants ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? 'Raahi',
    initial: (p.name ?? 'R').charAt(0).toUpperCase(),
  }))
  if (participants.length === 0 && ride.host) {
    participants.push({ id: ride.host.id, name: ride.host.name ?? 'Host', initial: (ride.host.name ?? 'H').charAt(0).toUpperCase() })
  }
  const route = routeCoords(ride)

  return (
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8">
      <Link href="/find" className="font-mono text-xs uppercase tracking-widest text-brick">← Back to rides</Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brick">Ride details · {fmtTime(ride.departTime)}</p>
          <h1 className="mt-3 font-serif text-5xl leading-none md:text-7xl">
            {ride.origin}<br /><em>to {ride.destination}</em>
          </h1>
          <div className="ticket-stub mt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink/55">Your host</p>
                <h2 className="mt-2 font-serif text-3xl">{ride.host?.name ?? ride.driver?.name ?? 'Raahi host'}</h2>
                <p className="mt-1 text-sm text-ink/60">Verified commuter · Trust {ride.host?.trustScore ?? 55}/100</p>
              </div>
              <div className="rounded-full bg-brick px-3 py-2 font-mono text-xs text-cream">✓ VERIFIED</div>
            </div>
            <div className="my-6 grid grid-cols-2 gap-4 border-y border-dashed border-ink/25 py-5 font-mono text-sm">
              <span>DEPART<br /><strong className="text-xl">{fmtTime(ride.departTime)}</strong></span>
              <span>SEATS LEFT<br /><strong className="text-xl">{seatsLeft}</strong></span>
              <span>ROUTE<br /><strong className="text-xl">{totalKm.toFixed(1)} km</strong></span>
              <span>FARE EST.<br /><strong className="text-xl">₹{estimatedFare}</strong></span>
            </div>
            {ride.isHost ? (
              <p className="font-mono text-xs uppercase tracking-widest text-ink/55">You are hosting this ride.</p>
            ) : ride.myBooking ? (
              <p className="font-mono text-xs uppercase tracking-widest text-brick">You have booked this ride ({ride.myBooking.pickup} → {ride.myBooking.drop})</p>
            ) : (
              <BookSeat rideId={ride.id} pickup={ride.originPlace} drop={ride.destinationPlace} />
            )}
            {(ride.isHost || ride.myBooking) && (
              <details className="mt-5 border-t border-dashed border-ink/30 pt-5">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-brick">Open group chat</summary>
                <div className="mt-4 h-[520px] overflow-hidden border-2 border-ink">
                  <RideChat rideId={ride.id} initialMessages={messages} participants={participants} />
                </div>
              </details>
            )}
          </div>
        </section>
        <aside className="order-first h-[420px] overflow-hidden border-2 border-ink lg:order-none lg:h-[620px]">
          <RideMapDynamic route={route} pickup={{ lat: ride.originPlace.lat, lng: ride.originPlace.lng, label: ride.origin }} drop={{ lat: ride.destinationPlace.lat, lng: ride.destinationPlace.lng, label: ride.destination }} />
        </aside>
      </div>
    </main>
  )
}
