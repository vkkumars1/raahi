'use client'

import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLngExpression } from 'leaflet'
import { useEffect } from 'react'

type Point = { lat: number; lng: number }
const icon = (color: string) => L.divIcon({ className: 'raahi-map-pin', html: `<span class="raahi-map-pin__dot" style="background:${color}"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] })
function Fit({ route }: { route: Point[] }) { const map = useMap(); useEffect(() => { if (route.length > 1) map.fitBounds(route.map((p) => [p.lat, p.lng] as [number, number]), { padding: [32, 32] }) }, [map, route]); return null }
export function RideMap({ route }: { route: Point[] }) { const center: LatLngExpression = route[0] ? [route[0].lat, route[0].lng] : [20.5937, 78.9629]; return <MapContainer center={center} zoom={route.length ? 11 : 5} scrollWheelZoom className="h-full min-h-[520px] w-full bg-[#e8dfd0]"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{route.length > 0 && <Marker position={[route[0].lat, route[0].lng]} icon={icon('#F2A33A')} />}{route.length > 1 && <Marker position={[route[route.length - 1].lat, route[route.length - 1].lng]} icon={icon('#C8442B')} />} {route.length > 1 && <Polyline positions={route.map((p) => [p.lat, p.lng] as LatLngExpression)} pathOptions={{ color: '#F2A33A', weight: 5 }} />}<Fit route={route} /></MapContainer> }
