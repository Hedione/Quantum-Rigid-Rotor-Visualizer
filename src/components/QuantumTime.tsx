import { useEffect, useRef } from 'react'
import type { QuantumTimeline } from '../physics/evolution'

export function QuantumTime({ timeline }: { timeline: QuantumTimeline }) {
  const label = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let handle = 0, previous = -Infinity
    const tick = (now: number) => {
      if (now - previous >= 100 && label.current) {
        previous = now
        const frame = timeline.read(now)
        label.current.textContent = `t = ${(frame.time * 1e12).toFixed(2)} ps`
        label.current.dataset.time = String(frame.time)
        label.current.dataset.relativePhase = String(frame.relativePhase)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [timeline])
  return <span ref={label} data-testid="quantum-time">t = 0.00 ps</span>
}
