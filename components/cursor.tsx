'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false)
  const [hovering, setHovering] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const springX = useSpring(x, { stiffness: 500, damping: 35, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 500, damping: 35, mass: 0.4 })

  useEffect(() => {
    const media = window.matchMedia('(pointer: fine)')
    setEnabled(media.matches)
    if (!media.matches) return

    const move = (event: MouseEvent) => {
      x.set(event.clientX)
      y.set(event.clientY)
      setHovering(Boolean((event.target as HTMLElement).closest('a, button, input, textarea, select, [data-cursor="interactive"]')))
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [x, y])

  if (!enabled) return null
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink bg-saffron mix-blend-multiply"
      animate={{ scale: hovering ? 2.7 : 1, opacity: hovering ? 0.72 : 0.9 }}
      style={{ x: springX, y: springY }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    />
  )
}
