import { Suspense } from 'react'
import { cookies } from 'next/headers'
import type { Ride } from '@/lib/api'
import { searchRides } from '@/lib/api'
import { FindResults } from '@/components/find-results'
import { FindAuthGate } from '@/components/find-auth-gate'

export const dynamic = 'force-dynamic'

const GURUGRAM_DEFAULTS = {
  pickupLat: 28.4318,
  pickupLng: 77.1049,
  dropLat: 28.4953,
  dropLng: 77.089,
}

function parseCoordinate(value: string | string[] | undefined, fallback: number) {
  if (typeof value !== 'string') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveTime(raw: string | string[] | undefined): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw
  const now = new Date()
  if (typeof raw === 'string' && /^\d{2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':').map(Number)
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1)
    return d.toISOString()
  }
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const pickup = typeof params.pickup === 'string' ? params.pickup : ''
  const drop = typeof params.drop === 'string' ? params.drop : ''
  const timeParam = typeof params.time === 'string' ? params.time : ''

  let rides: Ride[] = []
  try {
    rides = await searchRides({
      pickupLat: parseCoordinate(params.pickupLat, GURUGRAM_DEFAULTS.pickupLat),
      pickupLng: parseCoordinate(params.pickupLng, GURUGRAM_DEFAULTS.pickupLng),
      dropLat: parseCoordinate(params.dropLat, GURUGRAM_DEFAULTS.dropLat),
      dropLng: parseCoordinate(params.dropLng, GURUGRAM_DEFAULTS.dropLng),
      time: resolveTime(params.time),
      windowMinutes: parseCoordinate(params.windowMinutes, 180),
    })
  } catch {
    rides = []
  }
  return <FindResults rides={rides} initialPickup={pickup} initialDrop={drop} initialTime={timeParam} />
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-8">
      <div className="h-32 animate-pulse bg-ink/10" />
      <div className="mt-8 flex max-w-2xl flex-col gap-4">{[1, 2, 3].map((item) => <div key={item} className="ticket-stub h-56 animate-pulse bg-ink/10" />)}</div>
    </div>
  )
}

export default async function FindPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = (await cookies()).get('raahi_session')
  if (!session) return <FindAuthGate />
  return <Suspense fallback={<Skeleton />}><Results searchParams={searchParams} /></Suspense>
}
