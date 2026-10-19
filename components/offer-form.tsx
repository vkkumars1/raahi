'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, CarFront, ChevronDown, Loader2, MapPin, Navigation, Search, Bike } from 'lucide-react'
import { createRide } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

const OfferMap = dynamic(() => import('@/components/offer-map').then((module) => module.OfferMap), { ssr: false, loading: () => <div className="flex h-full min-h-[420px] items-center justify-center bg-[#e8dfd0] font-mono text-xs uppercase tracking-[0.16em] text-[#14110F]/60">Loading map...</div> })

const schema = z.object({
  origin: z.string().min(2, 'Choose where you start'),
  destination: z.string().min(2, 'Choose where you are headed'),
  departTime: z.string().min(1, 'Pick a departure time'),
  seats: z.coerce.number().int().min(1).max(4),
  vehicleType: z.enum(['car', 'bike']),
  pricePerKm: z.coerce.number().positive().max(100),
})
type FormValues = z.infer<typeof schema>
type Point = { lat: number; lng: number; label: string; displayName: string }
type Suggestion = Point

const initialValues: FormValues = { origin: '', destination: '', departTime: '08:30', seats: 1, vehicleType: 'car', pricePerKm: 3.5 }

export function OfferForm() {
  const router = useRouter()
  const [originPoint, setOriginPoint] = useState<Point>()
  const [destinationPoint, setDestinationPoint] = useState<Point>()
  const [route, setRoute] = useState<{ lat: number; lng: number }[]>([])
  const [distance, setDistance] = useState(0)
  const [duration, setDuration] = useState(0)
  const [routeState, setRouteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [suggestions, setSuggestions] = useState<{ field: 'origin' | 'destination'; items: Suggestion[] }>()
  const [searchError, setSearchError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) as never, defaultValues: initialValues })
  const values = watch()

  async function searchAddress(field: 'origin' | 'destination', query: string) {
    if (query.trim().length < 3) { setSuggestions(undefined); return }
    setSearchError('')
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=5&bounded=1&viewbox=76.8,29.0,77.8,28.2&q=${encodeURIComponent(`${query}, National Capital Region, India`)}`, { headers: { Accept: 'application/json' } })
      if (response.status === 429) throw new Error('Nominatim is busy. Please wait a moment and try again.')
      if (!response.ok) throw new Error('Address search is unavailable right now.')
      const data = await response.json()
      setSuggestions({ field, items: data.map((item: { lat: string; lon: string; display_name: string }) => ({ lat: Number(item.lat), lng: Number(item.lon), label: item.display_name.split(',').slice(0, 2).join(','), displayName: item.display_name })) })
    } catch (error) { setSearchError(error instanceof Error ? error.message : 'Could not search this address.'); setSuggestions(undefined) }
  }

  function choose(field: 'origin' | 'destination', point: Point) {
    setValue(field, point.displayName, { shouldValidate: true }); setSuggestions(undefined)
    if (field === 'origin') setOriginPoint(point); else setDestinationPoint(point)
  }

  async function loadRoute(nextOrigin = originPoint, nextDestination = destinationPoint) {
    if (!nextOrigin || !nextDestination) return
    setRouteState('loading')
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${nextOrigin.lng},${nextOrigin.lat};${nextDestination.lng},${nextDestination.lat}?overview=full&geometries=geojson`)
      const data = await response.json()
      if (!response.ok || data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No drivable route found between these places.')
      const selected = data.routes[0]
      setRoute(selected.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })))
      setDistance(selected.distance / 1000); setDuration(Math.round(selected.duration / 60)); setRouteState('ready')
    } catch { setRouteState('error'); setRoute([]) }
  }

  const totalFare = useMemo(() => distance * Number(values.pricePerKm || 0), [distance, values.pricePerKm])
  async function submit(values: FormValues) {
    if (!originPoint || !destinationPoint || route.length < 2) return
    await createRide({ ...values, routeGeoJSON: { type: 'LineString', coordinates: route.map((point) => [point.lng, point.lat]) } })
    setSubmitted(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  if (submitted) return <div className="ticket-stub flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><span className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-[#C8442B]">Ride posted</span><h2 className="font-display text-4xl">Your seat is on the road.</h2><p className="mt-3 max-w-sm text-[#14110F]/65">We&apos;ll take you to your dashboard to manage this commute.</p><span className="mt-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em]"><Loader2 className="size-4 animate-spin" /> Taking you there</span></div>

  return <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[minmax(360px,0.82fr)_minmax(0,1.18fr)]"><div className="order-2 lg:order-1"><form onSubmit={handleSubmit(submit)} className="ticket-stub p-6 sm:p-8">
    <div className="mb-8 flex items-start justify-between gap-4"><div><p className="eyebrow text-[#C8442B]">Host a commute</p><h1 className="mt-2 font-display text-4xl leading-[0.95] sm:text-5xl">Offer a seat.<br /><em>Share the ride.</em></h1></div><span className="font-mono text-xs text-[#14110F]/50">01 / 01</span></div>
    <div className="flex flex-col gap-5">
      <LocationField label="Starting point" name="origin" value={values.origin} register={register} error={errors.origin?.message} onChange={(event) => { register('origin').onChange(event); window.clearTimeout((window as typeof window & { raahiSearch?: number }).raahiSearch); (window as typeof window & { raahiSearch?: number }).raahiSearch = window.setTimeout(() => searchAddress('origin', event.target.value), 500) }} />
      <LocationField label="Destination" name="destination" value={values.destination} register={register} error={errors.destination?.message} onChange={(event) => { register('destination').onChange(event); window.clearTimeout((window as typeof window & { raahiSearch?: number }).raahiSearch); (window as typeof window & { raahiSearch?: number }).raahiSearch = window.setTimeout(() => searchAddress('destination', event.target.value), 500) }} />
      {suggestions && <div className="-mt-3 flex flex-col gap-1 border-2 border-[#14110F] bg-[#F4EDE0] p-1">{suggestions.items.map((item) => <button type="button" key={`${item.lat}-${item.lng}`} onClick={() => choose(suggestions.field, item)} className="flex items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#F2A33A]"><MapPin className="mt-0.5 size-4 shrink-0" /><span>{item.label}</span></button>)}</div>}
      {searchError && <p className="font-mono text-xs text-[#C8442B]">{searchError}</p>}
      <div className="grid gap-5 sm:grid-cols-2"><label className="field-label">Departure time<input type="time" {...register('departTime')} className="raahi-input font-mono" />{errors.departTime && <span className="field-error">{errors.departTime.message}</span>}</label><label className="field-label">Seats offered<div className="flex items-center"><button type="button" className="stepper-button" onClick={() => setValue('seats', Math.max(1, Number(values.seats) - 1))}>−</button><span className="raahi-input flex-1 text-center font-mono">{values.seats}</span><button type="button" className="stepper-button" onClick={() => setValue('seats', Math.min(4, Number(values.seats) + 1))}>+</button></div></label></div>
      <div><span className="field-label">Vehicle type</span><div className="mt-2 grid grid-cols-2 gap-2">{(['car', 'bike'] as const).map((type) => <button type="button" key={type} onClick={() => setValue('vehicleType', type)} className={`chip-toggle ${values.vehicleType === type ? 'chip-toggle--active' : ''}`}>{type === 'car' ? <CarFront className="size-4" /> : <Bike className="size-4" />}{type}</button>)}</div></div>
      <label className="field-label">Price per kilometre<div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono">₹</span><input type="number" step="0.5" {...register('pricePerKm')} className="raahi-input w-full pl-8 font-mono" /></div>{errors.pricePerKm && <span className="field-error">{errors.pricePerKm.message}</span>}</label>
    </div>
    {routeState === 'loading' && <div className="mt-6 flex items-center gap-2 border-y border-dashed border-[#14110F]/25 py-3 font-mono text-xs uppercase tracking-[0.12em]"><Loader2 className="size-4 animate-spin" /> Finding the best road...</div>}
    {routeState === 'error' && <p className="mt-6 border-y border-dashed border-[#C8442B] py-3 font-mono text-xs text-[#C8442B]">No route found. Try a nearby landmark or another destination.</p>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t-2 border-[#14110F] pt-5"><div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-[0.08em] text-[#14110F]/65">{distance > 0 && <span>{distance.toFixed(1)} km / {duration} min</span>}{distance > 0 && <span>Est. ₹{totalFare.toFixed(0)}</span>}</div><Button type="submit" disabled={isSubmitting || routeState !== 'ready'} className="w-full sm:w-auto">{isSubmitting ? 'Posting...' : 'Post this ride'} <ArrowRight data-icon="inline-end" /></Button></div>
    <button type="button" onClick={() => loadRoute()} disabled={!originPoint || !destinationPoint || routeState === 'loading'} className="mt-4 flex w-full items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-[#14110F]/65 underline underline-offset-4 disabled:opacity-40"><Navigation className="size-3" /> {routeState === 'ready' ? 'Route ready — recalculate' : 'Preview route'}</button>
    <div className="sr-only"><Search /></div>
    <div className="mt-4 text-center text-[10px] text-[#14110F]/45">By posting, you agree to only offer rides you can safely complete.</div>
  </form></div><div className="order-1 min-h-[420px] overflow-hidden border-2 border-[#14110F] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:min-h-0"><div className="relative h-full"><div className="pointer-events-none absolute left-5 top-5 z-[400] border-2 border-[#14110F] bg-[#F4EDE0] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em]">India / daily commute</div><OfferMap origin={originPoint} destination={destinationPoint} route={route} /></div></div></div>
}

function LocationField({ label, name, value, register, error, onChange }: { label: string; name: 'origin' | 'destination'; value: string; register: ReturnType<typeof useForm<FormValues>>['register']; error?: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <label className="field-label">{label}<div className="relative"><MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#C8442B]" /><input value={value} placeholder={name === 'origin' ? 'Sector 62, Noida' : 'Cyber City, Gurugram'} {...register(name)} onChange={onChange} className="raahi-input w-full pl-10" autoComplete="off" /></div>{error && <span className="field-error">{error}</span>}</label>
}
