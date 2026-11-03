import { useEffect, useRef } from 'react'
import type { QuantumTimeline } from '../physics/evolution'

/** Retain machine-readable clock state without an elapsed-time readout. */
export function QuantumTime({ timeline }: { timeline: QuantumTimeline }) {
  const marker = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let handle = 0, previous = -Infinity
    const tick = (now: number) => {
      if (now - previous >= 100 && marker.current) {
        previous = now
        const frame = timeline.read(now)
        marker.current.dataset.time = String(frame.time)
        marker.current.dataset.relativePhase = String(frame.relativePhase)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [timeline])
  return <span ref={marker} hidden data-testid="quantum-time" />
}
