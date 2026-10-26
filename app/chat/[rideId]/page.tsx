import Link from 'next/link'

export const dynamic = 'force-dynamic'
import { getRide, getRideMessages } from '@/lib/api'
import { RideChat } from '@/components/ride-chat'

export default async function ChatPage({ params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params
  const [ride, messages] = await Promise.all([getRide(rideId), getRideMessages(rideId)])
  const participants = [{ id: ride.driver?.id ?? 'demo-user', name: ride.driver?.name ?? 'Host', initial: (ride.driver?.name ?? 'H').charAt(0) }]
  return <main className="mx-auto max-w-3xl px-4 py-5 md:px-8"><Link href={`/rides/${rideId}`} className="font-mono text-xs uppercase tracking-widest text-brick">← Back to ride</Link><div className="mt-5 overflow-hidden border-2 border-ink shadow-[6px_6px_0_#14110F]"><RideChat rideId={rideId} initialMessages={messages} participants={participants} fullPage /></div></main>
}
