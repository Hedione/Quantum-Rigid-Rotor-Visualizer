import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SimulationMode } from '../types'

export const MODE_LABELS: Record<SimulationMode, string> = {
  static: 'Static mode', superposition: 'Superposition mode', transition: 'Transition mode',
}

export function ModePicker({ mode, onSelect }: { mode: SimulationMode; onSelect: (mode: SimulationMode) => void }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return <div ref={container} className="mode-picker" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus() }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" className="mode-picker-trigger" aria-label="Simulation mode" aria-expanded={open} aria-controls="mode-choices" onClick={() => setOpen(!open)}>
      <span><small>SIMULATION MODE</small><strong>{MODE_LABELS[mode]}</strong></span><ChevronDown size={16} aria-hidden="true" />
    </button>
    <div className="mode-picker-reveal" data-open={open} aria-hidden={!open} inert={!open}>
      <div><div id="mode-choices" className="mode-picker-options" role="group" aria-label="Simulation modes">
        {(Object.keys(MODE_LABELS) as SimulationMode[]).map(option => <button key={option} type="button" className="mode-option" aria-pressed={mode === option} onClick={() => { onSelect(option); setOpen(false); trigger.current?.focus() }}>
          <span>{MODE_LABELS[option]}</span>{mode === option && <Check size={13} aria-hidden="true" />}
        </button>)}
      </div></div>
    </div>
  </div>
}
