'use client'

import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLngExpression } from 'leaflet'
import { useEffect } from 'react'

type Point = { lat: number; lng: number }

const icon = (color: string, label?: string) =>
  L.divIcon({
    className: 'raahi-map-pin',
    html: `<span class="raahi-map-pin__dot" style="background:${color};display:inline-flex;align-items:center;justify-content:center;color:#fff;font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace">${label ?? ''}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })

function Fit({ points }: { points: Point[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [40, 40] })
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13)
  }, [map, points])
  return null
}

type Props = {
  route: Point[]
  pickup?: Point & { label?: string }
  drop?: Point & { label?: string }
}

export function RideMap({ route, pickup, drop }: Props) {
  const center: LatLngExpression = route[0] ? [route[0].lat, route[0].lng] : [28.46, 77.03]
  const all: Point[] = [...route]
  if (pickup) all.push(pickup)
  if (drop) all.push(drop)

  return (
    <MapContainer center={center} zoom={route.length ? 12 : 11} scrollWheelZoom className="h-full min-h-[520px] w-full bg-[#e8dfd0]">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {route.length > 0 && (
        <Marker position={[route[0].lat, route[0].lng]} icon={icon('#F2A33A', 'A')}>
          <Tooltip permanent={false} direction="top">Host origin</Tooltip>
        </Marker>
      )}
      {route.length > 1 && (
        <Marker position={[route[route.length - 1].lat, route[route.length - 1].lng]} icon={icon('#C8442B', 'B')}>
          <Tooltip permanent={false} direction="top">Host drop</Tooltip>
        </Marker>
      )}
      {route.length > 1 && (
        <Polyline positions={route.map((p) => [p.lat, p.lng] as LatLngExpression)} pathOptions={{ color: '#F2A33A', weight: 5 }} />
      )}
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={icon('#1F7A3C', 'P')}>
          <Tooltip permanent direction="right">{pickup.label ?? 'Your pickup'}</Tooltip>
        </Marker>
      )}
      {drop && (
        <Marker position={[drop.lat, drop.lng]} icon={icon('#14110F', 'D')}>
          <Tooltip permanent direction="right">{drop.label ?? 'Your drop'}</Tooltip>
        </Marker>
      )}
      {pickup && route[0] && (
        <Polyline positions={[[pickup.lat, pickup.lng], [route[0].lat, route[0].lng]]} pathOptions={{ color: '#1F7A3C', weight: 2, dashArray: '6 6' }} />
      )}
      {drop && route.length > 0 && (
        <Polyline positions={[[drop.lat, drop.lng], [route[route.length - 1].lat, route[route.length - 1].lng]]} pathOptions={{ color: '#14110F', weight: 2, dashArray: '6 6' }} />
      )}
      <Fit points={all} />
    </MapContainer>
  )
}
