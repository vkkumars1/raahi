import { OfferForm } from '@/components/offer-form'

export const metadata = { title: 'Offer a ride — Raahi', description: 'Share your daily commute with a verified Raahi community.' }

export default function OfferPage() {
  return <main className="min-h-screen bg-[#F4EDE0] px-4 pb-10 pt-24 sm:px-8 lg:px-12"><OfferForm /></main>
}
