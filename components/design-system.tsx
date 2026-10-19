import { cn } from '@/lib/utils'

export function PaperGrain() {
  return <div aria-hidden="true" className="paper-grain" />
}

export function RoadLane({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('road-lane', className)} />
}

export function TicketStub({ children, className }: { children: React.ReactNode; className?: string }) {
  return <article className={cn('ticket-stub', className)}>{children}</article>
}
