'use client'

import dynamic from 'next/dynamic'

export const RideMapDynamic = dynamic(
  () => import('@/components/ride-map').then((mod) => mod.RideMap),
  { ssr: false, loading: () => <div className="h-full min-h-[520px] animate-pulse bg-[#e8dfd0]" /> },
)
