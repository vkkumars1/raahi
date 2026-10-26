import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
import { cookies } from 'next/headers'
import { searchRides } from '@/lib/api'
import { FindResults } from '@/components/find-results'
import { FindAuthGate } from '@/components/find-auth-gate'

function parseCoordinate(value: string | undefined, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const pickup = typeof params.pickup === 'string' ? params.pickup : ''
  const drop = typeof params.drop === 'string' ? params.drop : ''
  const time = typeof params.time === 'string' ? params.time : ''
  const rides = await searchRides({ pickupLat: parseCoordinate(params.pickupLat as string, 12.9716), pickupLng: parseCoordinate(params.pickupLng as string, 77.5946), dropLat: parseCoordinate(params.dropLat as string, 12.9698), dropLng: parseCoordinate(params.dropLng as string, 77.75), time, windowMinutes: parseCoordinate(params.windowMinutes as string, 30) })
  return <FindResults rides={rides} initialPickup={pickup} initialDrop={drop} initialTime={time} />
}
function Skeleton() { return <div className="mx-auto max-w-7xl px-5 pb-20 pt-8"><div className="h-32 animate-pulse bg-ink/10" /><div className="mt-8 flex max-w-2xl flex-col gap-4">{[1, 2, 3].map((item) => <div key={item} className="ticket-stub h-56 animate-pulse bg-ink/10" />)}</div></div> }
export default async function FindPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = (await cookies()).get('raahi_session')
  if (!session) return <FindAuthGate />
  return <Suspense fallback={<Skeleton />}><Results searchParams={searchParams} /></Suspense>
}
