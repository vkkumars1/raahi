import { Suspense } from "react"
import { getDashboardStats, getMe, getMyBookings, getMyRides } from "@/lib/api"
import { DashboardClient } from "@/components/dashboard-client"

async function DashboardData() {
  const [user, stats, rides, bookings] = await Promise.all([getMe(), getDashboardStats(), getMyRides(), getMyBookings()])
  return <DashboardClient user={user} stats={stats} rides={rides} bookings={bookings} />
}

function DashboardSkeleton() {
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-5 py-10 md:px-10"><div className="h-24 animate-pulse bg-ink/10" /><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="h-28 animate-pulse bg-ink/10" />)}</div><div className="h-72 animate-pulse bg-ink/10" /></main>
}

export default function DashboardPage() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardData /></Suspense>
}
