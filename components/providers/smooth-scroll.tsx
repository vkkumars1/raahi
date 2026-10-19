'use client'

import { useEffect, useRef } from 'react'
import { useScroll } from 'framer-motion'
import Lenis from 'lenis'

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const { scrollY } = useScroll()

  useEffect(() => {
    const lenis = new Lenis({ autoRaf: false, smoothWheel: true, lerp: 0.085 })
    lenisRef.current = lenis

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    const syncScroll = ({ scroll }: { scroll: number }) => {
      scrollY.set(scroll)
    }
    lenis.on('scroll', syncScroll)

    return () => {
      cancelAnimationFrame(frame)
      lenis.off('scroll', syncScroll)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [scrollY])

  return <>{children}</>
}
