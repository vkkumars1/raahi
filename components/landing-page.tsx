'use client'

import { useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight, Check, ChevronRight, CircleDot, Leaf, Menu, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoadLane, TicketStub } from '@/components/design-system'

const stats = [
  { value: '1.8M', label: 'cars with just one person', note: 'on Indian roads every day', icon: Users },
  { value: '₹4,200', label: 'average monthly fuel cost', note: 'per city commuter', icon: CircleDot },
  { value: '47 min', label: 'lost in traffic', note: 'on an average commute', icon: Menu },
]

const steps = [
  { number: '01', title: 'Verify', copy: 'Your work email and phone make the first handshake safe.', detail: 'Trusted people, real identities.', icon: ShieldCheck },
  { number: '02', title: 'Match', copy: 'Find someone heading your way, at a time that works for both.', detail: 'Routes that make sense.', icon: Users },
  { number: '03', title: 'Ride', copy: 'A little conversation. A quieter road. A better morning.', detail: 'Share the everyday.', icon: ChevronRight },
  { number: '04', title: 'Split', copy: 'Fair fares, cleanly divided. Your wallet will notice.', detail: 'No awkward maths.', icon: Check },
]

function HeroRoad() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const pathLength = useTransform(scrollYProgress, [0.1, 0.8], [0.05, 1])
  const carX = useTransform(scrollYProgress, [0.12, 0.82], ['8%', '78%'])

  return (
    <div ref={ref} className="relative mt-12 h-[150px] w-full overflow-hidden md:mt-0 md:h-[240px]">
      <svg aria-hidden="true" viewBox="0 0 900 220" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <path d="M-30 175 C 170 15, 290 220, 470 110 S 715 10, 930 62" fill="none" stroke="var(--color-ink)" strokeWidth="30" strokeLinecap="round" opacity=".11" />
        <motion.path d="M-30 175 C 170 15, 290 220, 470 110 S 715 10, 930 62" fill="none" stroke="var(--color-brick)" strokeWidth="2" strokeDasharray="8 10" style={{ pathLength }} />
      </svg>
      <motion.div style={{ left: carX }} className="absolute top-[48%] -translate-y-1/2">
        <div className="relative flex h-10 w-[72px] items-center justify-center rounded-[45%] border-2 border-ink bg-saffron shadow-[4px_4px_0_var(--color-ink)]">
          <span className="absolute -top-3 left-3 h-3 w-9 rounded-t-full border-2 border-b-0 border-ink bg-cream" />
          <span className="absolute bottom-[-7px] left-2 size-3 rounded-full border-2 border-ink bg-cream" />
          <span className="absolute bottom-[-7px] right-2 size-3 rounded-full border-2 border-ink bg-cream" />
          <span className="font-mono text-[8px] font-bold">RAAHI</span>
        </div>
      </motion.div>
      <div className="absolute bottom-2 left-0 font-mono text-[10px] uppercase tracking-[.2em] text-ink/60">Bengaluru → Indiranagar</div>
    </div>
  )
}

function AnimatedStat({ value, label, note, icon: Icon, index }: typeof stats[number] & { index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ delay: index * .1 }} className="border-t-2 border-ink pt-5">
      <Icon className="mb-8 size-5 text-brick" strokeWidth={1.5} aria-hidden="true" />
      <p className="font-mono text-3xl tracking-[-.06em] md:text-4xl">{value}</p>
      <p className="mt-2 max-w-[180px] text-base leading-tight">{label}</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[.14em] text-ink/55">{note}</p>
    </motion.div>
  )
}

function HorizontalSteps() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-72%'])

  return (
    <section ref={ref} className="relative h-[250vh] bg-ink text-cream" id="how-it-works">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden py-12">
        <div className="mx-auto w-full max-w-[1280px] px-5 md:px-10">
          <div className="mb-10 flex items-end justify-between border-b border-cream/25 pb-5">
            <div><p className="eyebrow text-saffron">02 / The ritual</p><h2 className="mt-3 max-w-xl text-4xl leading-[.95] tracking-[-.04em] md:text-6xl">Four small steps.<br />One lighter commute.</h2></div>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-cream/50 md:block">Scroll to move →</span>
          </div>
          <motion.div style={{ x }} className="flex w-max gap-5 md:gap-8">
            {steps.map(({ number, title, copy, detail, icon: Icon }) => (
              <div key={number} className="flex h-[330px] w-[78vw] max-w-[560px] flex-col justify-between border border-cream/30 p-6 md:h-[390px] md:w-[42vw] md:p-9">
                <div className="flex justify-between"><span className="font-mono text-sm text-saffron">{number}</span><Icon className="size-7 text-cream/70" strokeWidth={1.3} /></div>
                <div><h3 className="text-5xl tracking-[-.04em] md:text-7xl">{title}</h3><p className="mt-5 max-w-sm text-lg leading-snug text-cream/70">{copy}</p></div>
                <p className="font-mono text-[10px] uppercase tracking-[.16em] text-saffron">{detail}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function Impact() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20%' })
  return <section ref={ref} className="bg-saffron px-5 py-24 md:px-10 md:py-36"><div className="mx-auto grid max-w-[1280px] gap-12 md:grid-cols-[.8fr_1.2fr] md:items-end"><div><p className="eyebrow">05 / The ripple effect</p><h2 className="mt-5 max-w-lg text-5xl leading-[.9] tracking-[-.05em] md:text-7xl">A better ride leaves a mark.</h2></div><div className="grid grid-cols-2 gap-5 border-t-2 border-ink pt-5"><div><Leaf className="mb-10 size-6" strokeWidth={1.5} /><motion.p className="font-mono text-4xl md:text-6xl" initial={{ opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ duration: .6 }}>12.4 kg</motion.p><p className="mt-2 max-w-[170px] text-sm">CO₂ saved per shared commute</p></div><div><ArrowUpRight className="mb-10 size-6" strokeWidth={1.5} /><motion.p className="font-mono text-4xl md:text-6xl" initial={{ opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ duration: .6, delay: .15 }}>₹1,840</motion.p><p className="mt-2 max-w-[170px] text-sm">kept in one commuter&apos;s pocket</p></div></div></div></section>
}

export function LandingPage() {
  return <main>
    <header className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-5 md:px-10"><a href="#top" className="font-heading text-2xl font-semibold tracking-[-.06em]">raahi<span className="text-brick">.</span></a><nav className="hidden items-center gap-8 font-mono text-[10px] uppercase tracking-[.16em] md:flex"><a href="#how-it-works">How it works</a><a href="#fares">Fares</a><a href="#impact">Impact</a></nav><Button variant="primary" size="sm">Get early access <ArrowUpRight data-icon="inline-end" /></Button></header>
    <section id="top" className="mx-auto max-w-[1280px] px-5 pb-20 pt-14 md:px-10 md:pb-32 md:pt-24"><div className="grid items-end gap-10 md:grid-cols-[1.15fr_.85fr]"><div><p className="eyebrow">01 / Shared, verified, everyday</p><h1 className="mt-6 max-w-3xl text-[clamp(4.5rem,12vw,11rem)] leading-[.78] tracking-[-.075em]">Saath<br /><span className="ml-[.18em] text-brick">chalein.</span></h1></div><div className="max-w-xs pb-3 md:pb-12"><p className="text-xl leading-tight">Your everyday commute, made a little more human.</p><p className="mt-5 text-sm leading-relaxed text-ink/65">Raahi connects verified commuters heading the same way — so the road feels less like a chore and more like a shared story.</p><Button className="mt-7" variant="primary">Find your raahi <ArrowUpRight data-icon="inline-end" /></Button></div></div><HeroRoad /></section>
    <section className="border-y-2 border-ink bg-cream/60 px-5 py-20 md:px-10 md:py-28"><div className="mx-auto max-w-[1280px]"><div className="grid gap-10 md:grid-cols-[1.05fr_1fr]"><div><p className="eyebrow text-brick">The empty seat problem</p><h2 className="mt-5 max-w-lg text-5xl leading-[.9] tracking-[-.05em] md:text-7xl">A city full of empty seats.</h2></div><p className="max-w-sm text-lg leading-snug text-ink/65 md:pt-12">Every solo ride is a missed chance — to save money, make a friend, or simply take one less car off the road.</p></div><RoadLane className="my-14" /><div className="grid gap-10 md:grid-cols-3">{stats.map((stat, index) => <AnimatedStat key={stat.value} {...stat} index={index} />)}</div></div></section>
    <HorizontalSteps />
    <section id="fares" className="mx-auto max-w-[1280px] px-5 py-24 md:px-10 md:py-36"><div className="grid gap-10 md:grid-cols-[.8fr_1.2fr] md:items-start"><div><p className="eyebrow text-brick">03 / The fair fare</p><h2 className="mt-5 max-w-sm text-5xl leading-[.9] tracking-[-.05em] md:text-7xl">More ride.<br />Less spend.</h2></div><TicketStub className="p-6 md:p-10"><div className="flex items-start justify-between border-b border-dashed border-ink/40 pb-5"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-ink/55">Sample route</p><p className="mt-2 text-2xl">Koramangala → Whitefield</p></div><span className="font-mono text-xs">06:45</span></div><div className="divide-y divide-dashed divide-ink/25">{[['Raahi', '₹82', 'shared'], ['Cab', '₹420', 'solo'], ['Auto', '₹230', 'solo']].map(([name, price, type], i) => <div key={name} className="grid grid-cols-[1fr_auto_auto] items-center gap-5 py-5"><span className={i === 0 ? 'font-heading text-2xl' : 'text-lg text-ink/55'}>{name}</span><span className="font-mono text-lg">{price}</span><span className="font-mono text-[9px] uppercase tracking-widest text-ink/45">{type}</span></div>)}</div><p className="mt-3 font-mono text-[10px] uppercase tracking-[.14em] text-ink/55">Same road. A different rhythm.</p></TicketStub></div></section>
    <div id="impact"><Impact /></div>
    <footer className="overflow-hidden bg-brick px-5 pb-8 pt-20 text-cream md:px-10 md:pt-28"><div className="mx-auto max-w-[1280px]"><div className="flex flex-col justify-between gap-14 md:flex-row"><div><p className="eyebrow text-cream/70">06 / Come along</p><h2 className="mt-5 max-w-md text-4xl leading-[.95] md:text-6xl">The road is better together.</h2></div><div className="flex gap-16 font-mono text-[10px] uppercase tracking-[.16em] text-cream/70"><a href="#top">Back to top ↑</a><a href="mailto:hello@raahi.in">Say hello ↗</a></div></div><motion.p initial={{ y: 80, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="mt-24 whitespace-nowrap font-heading text-[25vw] leading-[.65] tracking-[-.09em] text-cream/95 md:mt-32">raahi.</motion.p><div className="mt-16 flex justify-between border-t border-cream/35 pt-5 font-mono text-[9px] uppercase tracking-[.16em] text-cream/65"><span>Made for the everyday</span><span>© 2025 Raahi</span></div></div></footer>
  </main>
}
