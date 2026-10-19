"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { createRating, completeRide, type Booking, type DashboardStats, type Ride, type User } from "@/lib/api"
import { useUserStore } from "@/lib/user-store"

const monthly = [42, 68, 54, 92, 76, 112]

function Count({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  return <span className="font-mono text-2xl tabular-nums">{prefix}{value.toLocaleString("en-IN")}{suffix}</span>
}

function StatCard({ label, value, prefix, suffix }: { label: string; value: number; prefix?: string; suffix?: string }) {
  return <div className="border-t-2 border-ink pt-3"><p className="eyebrow mb-3 text-ink/60">{label}</p><Count value={value} prefix={prefix} suffix={suffix} /></div>
}

function RideCard({ ride, booking, onComplete }: { ride: Ride; booking?: Booking; onComplete: (id: string) => void }) {
  const isHost = Boolean(ride.driver?.id === "demo-user" || ride.driver?.id === booking?.ride?.driver?.id)
  return <article className="ticket-stub flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div><p className="eyebrow text-brick">{isHost ? "hosting" : "riding"} · {ride.departTime}</p><h3 className="mt-2 text-2xl">{ride.origin} <span className="text-brick">→</span> {ride.destination}</h3><p className="mt-2 font-mono text-xs text-ink/60">{ride.distanceKm ?? 0} km · ₹{Math.round((ride.distanceKm ?? 0) * ride.pricePerKm)} · {ride.availableSeats ?? ride.seats} seats left</p></div><div className="flex gap-2"><Link className="button button--secondary px-3 py-2 text-xs" href={`/chat/${ride.id}`}>Open chat</Link>{isHost && <button className="button button--primary px-3 py-2 text-xs" onClick={() => onComplete(ride.id)}>Mark completed</button>}</div></article>
}

function RatingModal({ ride, close }: { ride: Ride; close: () => void }) {
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [sent, setSent] = useState(false)
  async function submit() { if (!rating) return; await createRating({ rideId: ride.id, rating, comment }); setSent(true) }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5" role="dialog" aria-modal="true"><div className="ticket-stub w-full max-w-md p-6"><div className="flex justify-between"><h2 className="text-3xl">How was the ride?</h2><button aria-label="Close" onClick={close}>×</button></div>{sent ? <p className="mt-6 font-mono text-sm text-brick">Rating saved. Dhanyavaad.</p> : <><div className="mt-6 flex gap-2" aria-label="Rating"><span className="sr-only">Choose a rating</span>{[1,2,3,4,5].map((star) => <button key={star} className={`text-3xl ${star <= rating ? "text-saffron" : "text-ink/20"}`} onClick={() => setRating(star)} aria-label={`${star} stars`}>★</button>)}</div><textarea className="input-rail mt-5 min-h-28" placeholder="A quick note (optional)" value={comment} onChange={(event) => setComment(event.target.value)} /><button className="button button--primary mt-5 w-full" onClick={submit} disabled={!rating}>Save rating</button></>}</div></div>
}

export function DashboardClient({ user, stats, rides, bookings }: { user: User; stats: DashboardStats; rides: Ride[]; bookings: Booking[] }) {
  const setUser = useUserStore((state) => state.setUser); useMemo(() => { setUser(user) }, [setUser, user])
  const [ratingRide, setRatingRide] = useState<Ride | null>(null); const [completed, setCompleted] = useState<string[]>([])
  const upcoming = rides.filter((ride) => !completed.includes(ride.id)); const past = rides.filter((ride) => completed.includes(ride.id))
  async function markCompleted(id: string) { await completeRide(id); setCompleted((items) => [...items, id]) }
  return <main className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10 md:px-10"><header className="flex flex-col gap-5 border-b-2 border-ink pb-7 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow text-brick">your raahi log</p><h1 className="mt-2 text-5xl md:text-7xl">Namaste, {user.name?.split(" ")[0] ?? "Raahi"}.</h1></div><span className="stamp">{user.verified ? "verified raahi" : "new raahi"}</span></header><section className="grid gap-7 sm:grid-cols-2 md:grid-cols-4"><StatCard label="money saved" value={stats.moneySaved} prefix="₹" /><StatCard label="CO₂ saved" value={stats.co2Saved} suffix=" kg" /><StatCard label="rides shared" value={stats.rides} /><StatCard label="avg rating" value={Number((stats as DashboardStats & { avgRating?: number }).avgRating ?? 4.8)} suffix=" / 5" /></section><section><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow text-brick">next departures</p><h2 className="mt-2 text-4xl">Upcoming rides</h2></div><Link className="button button--secondary px-3 py-2 text-xs" href={user.role === "host" ? "/offer" : "/find"}>{user.role === "host" ? "Offer a ride" : "Find a ride"}</Link></div><div className="flex flex-col gap-4">{upcoming.length ? upcoming.map((ride) => <RideCard key={ride.id} ride={ride} booking={bookings.find((item) => item.rideId === ride.id)} onComplete={markCompleted} />) : <Empty role={user.role} />}</div></section><section className="grid gap-8 lg:grid-cols-[1fr_340px]"><div><p className="eyebrow text-brick">the archive</p><h2 className="mt-2 text-4xl">Past rides</h2><div className="mt-5 flex flex-col gap-3">{past.length ? past.map((ride) => <div key={ride.id} className="flex items-center justify-between border-b border-ink/25 py-4"><div><p className="font-mono text-xs">{ride.departTime}</p><p>{ride.origin} → {ride.destination}</p></div><button className="button button--secondary px-3 py-2 text-xs" onClick={() => setRatingRide(ride)}>Rate</button></div>) : <p className="mt-5 text-ink/60">Your completed rides will live here.</p>}</div></div><SavingsChart /></section>{ratingRide && <RatingModal ride={ratingRide} close={() => setRatingRide(null)} />}</main>
}

function Empty({ role }: { role?: string }) { const host = role === "host"; return <div className="ticket-stub p-8 text-center"><p className="text-3xl">No rides yet.</p><p className="mt-2 text-ink/60">Your next shared kilometre starts here.</p><Link href={host ? "/offer" : "/find"} className="button button--primary mt-5 inline-flex">{host ? "Offer your first ride" : "Find your first ride"}</Link></div> }
function SavingsChart() { return <div className="ticket-stub p-5"><p className="eyebrow text-brick">six month trail</p><h2 className="mt-2 text-3xl">Savings</h2><svg className="mt-7 h-48 w-full" viewBox="0 0 360 180" role="img" aria-label="Monthly savings bar chart">{monthly.map((value, index) => <g key={value}><rect x={index * 56 + 8} y={180 - value} width="32" height={value} fill={index % 2 ? "#14110F" : "#F2A33A"} /><text x={index * 56 + 24} y="176" textAnchor="middle" fontFamily="monospace" fontSize="9">{["M","J","J","A","S","O"][index]}</text></g>)}</svg></div> }
