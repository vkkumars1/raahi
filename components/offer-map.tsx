'use client'

import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLngExpression } from 'leaflet'
import { useEffect } from 'react'

const originIcon = L.divIcon({ className: 'raahi-map-pin', html: '<span class="raahi-map-pin__dot raahi-map-pin__dot--origin"></span>', iconSize: [24, 24], iconAnchor: [12, 12] })
const destinationIcon = L.divIcon({ className: 'raahi-map-pin', html: '<span class="raahi-map-pin__dot raahi-map-pin__dot--destination"></span>', iconSize: [24, 24], iconAnchor: [12, 12] })

type Point = { lat: number; lng: number }

function FitRoute({ points }: { points: Point[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map((point) => [point.lat, point.lng] as [number, number]), { padding: [38, 38] })
  }, [map, points])
  return null
}

export function OfferMap({ origin, destination, route }: { origin?: Point; destination?: Point; route: Point[] }) {
  const center: LatLngExpression = origin ? [origin.lat, origin.lng] : [20.5937, 78.9629]
  return (
    <MapContainer center={center} zoom={origin ? 11 : 5} scrollWheelZoom className="h-full min-h-[420px] w-full bg-[#e8dfd0]">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {origin && <Marker position={[origin.lat, origin.lng]} icon={originIcon} />}
      {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />}
      {route.length > 1 && <Polyline positions={route.map((point) => [point.lat, point.lng] as LatLngExpression)} pathOptions={{ color: '#F2A33A', weight: 5, opacity: 0.95 }} />}
      <FitRoute points={[...(origin ? [origin] : []), ...(destination ? [destination] : [])]} />
    </MapContainer>
  )
}
