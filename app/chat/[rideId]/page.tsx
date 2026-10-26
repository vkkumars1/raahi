import Link from 'next/link'
import { getRide, getRideMessages, type Message } from '@/lib/api'
import { RideChat } from '@/components/ride-chat'

export const dynamic = 'force-dynamic'

export default async function ChatPage({ params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params

  let ride
  try {
    ride = await getRide(rideId)
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-serif text-3xl">Ride not found</h1>
        <Link href="/find" className="mt-5 inline-block border-2 border-ink bg-saffron px-5 py-3 font-mono text-xs uppercase tracking-widest shadow-[3px_3px_0_#14110F]">Back to find</Link>
      </main>
    )
  }

  if (!ride.isHost && !ride.myBooking) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-serif text-3xl">Group chat is for members only</h1>
        <p className="mt-3 text-ink/60">Book this ride to join the conversation.</p>
        <Link href={`/rides/${rideId}`} className="mt-5 inline-block border-2 border-ink bg-saffron px-5 py-3 font-mono text-xs uppercase tracking-widest shadow-[3px_3px_0_#14110F]">Open ride</Link>
      </main>
    )
  }

  let messages: Message[] = []
  try {
    messages = await getRideMessages(rideId)
  } catch {
    messages = []
  }

  const participants = (ride.participants ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? 'Raahi',
    initial: (p.name ?? 'R').charAt(0).toUpperCase(),
  }))
  if (participants.length === 0 && ride.host) {
    participants.push({ id: ride.host.id, name: ride.host.name ?? 'Host', initial: (ride.host.name ?? 'H').charAt(0).toUpperCase() })
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 md:px-8">
      <Link href={`/rides/${rideId}`} className="font-mono text-xs uppercase tracking-widest text-brick">← Back to ride</Link>
      <div className="mt-5 overflow-hidden border-2 border-ink shadow-[6px_6px_0_#14110F]">
        <RideChat rideId={rideId} initialMessages={messages} participants={participants} fullPage />
      </div>
    </main>
  )
}
