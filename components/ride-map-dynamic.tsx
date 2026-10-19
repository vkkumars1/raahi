'use client'

import dynamic from 'next/dynamic'

export const RideMapDynamic = dynamic(() => import('@/components/ride-map').then((mod) => mod.RideMap), { ssr: false })
