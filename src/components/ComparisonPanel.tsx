import { useState, type KeyboardEvent } from 'react'
import type { Settings } from '../types'
import type { QuantumTimeline } from '../physics/evolution'
import type { SampleStatistics } from '../physics/sampling'
import type { PreparedQuantumState } from '../preparation/types'
import { blochState } from '../physics/bloch'
import type { UpdateSettings } from './Controls'
import { useQuantumFrame } from './CoherentTransition'
import { ClassicalControls } from './SceneControls'
import { FieldControls } from './FieldControls'
import { Scene } from './Scene'
import { useKeyboardShortcut } from '../useKeyboardShortcut'

function BlochReadouts({ settings, timeline }: { settings: Settings; timeline: QuantumTimeline }) {
  const frame = useQuantumFrame(timeline), state = blochState(settings, frame?.coefficients)
  const fixed = (value: number) => Math.abs(value) < 0.0005 ? '0.000' : value.toFixed(3)
  return <section className="inline-scene-controls" aria-label="Bloch sphere state">
    <h3 className="scene-controls-heading">Bloch sphere</h3>
    <div className="scene-controls-body bloch-readouts" data-testid="bloch-readouts" data-defined={!!state} data-x={state?.x} data-y={state?.y} data-z={state?.z} data-phase={state?.phase}>
      {state ? <>
        <div className="bloch-basis"><span>North |1⟩</span><strong>|J = {settings.j}, m<sub>J</sub> = {settings.m}⟩</strong><span>South |2⟩</span><strong>|J = {settings.j2}, m<sub>J</sub> = {settings.m2}⟩</strong></div>
        <div className="bloch-coordinates">{(['x', 'y', 'z'] as const).map(axis => <div key={axis}><span>{axis.toUpperCase()}</span><output aria-label={`Bloch ${axis.toUpperCase()}`} aria-live="off">{fixed(state[axis])}</output></div>)}</div>
        <div className="bloch-populations"><span>P₁ <strong>{(state.first * 100).toFixed(1)}%</strong></span><span>P₂ <strong>{(state.second * 100).toFixed(1)}%</strong></span></div>
        <div className="bloch-phase">Phase φ₂ − φ₁ <strong>{state.phase === undefined ? '—' : `${(state.phase * 180 / Math.PI).toFixed(1)}°`}</strong></div>
      </> : <p role="status">Choose two different rotational states to define a two-state Bloch sphere.</p>}
      <p>Rotational-state populations and relative phase, not molecular orientation. The vector uses the laboratory-frame amplitudes.</p>
    </div>
  </section>
}

export function ComparisonPanel({ settings, update, onStats, timeline, prepared }: { settings: Settings; update: UpdateSettings; onStats: (stats: SampleStatistics) => void; timeline: QuantumTimeline; prepared: PreparedQuantumState | null }) {
  const [selectedBloch, setBloch] = useState(false)
  const paired = settings.mode === 'superposition' || settings.mode === 'transition'
  useKeyboardShortcut('/', () => setBloch(selected => !selected), paired)
  const bloch = paired && selectedBloch
  const referenceLabel = settings.coherentTransition ? 'Field & dipole' : 'Classical rotors'
  const mode = bloch ? 'bloch' : settings.coherentTransition ? 'field' : 'classical'
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? false : event.key === 'End' ? true : !bloch
    setBloch(next)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next ? 1 : 0]?.focus()
  }
  return <div className="scene-column classical-column">
    <div className="scene-pane classical-pane" data-testid="pane-classical">
      {paired ? <div className="pane-label comparison-tabs" role="tablist" aria-label="Comparison view" onKeyDown={keys}>
        <button id="comparison-reference-tab" type="button" role="tab" aria-selected={!bloch} aria-controls="comparison-panel" tabIndex={bloch ? -1 : 0} onClick={() => setBloch(false)}>{referenceLabel}</button>
        <button id="comparison-bloch-tab" type="button" role="tab" aria-selected={bloch} aria-controls="comparison-panel" tabIndex={bloch ? 0 : -1} onClick={() => setBloch(true)}>Bloch sphere</button>
      </div> : <div className="pane-label">CLASSICAL ROTOR</div>}
      <div className="pane-canvas comparison-panel" id="comparison-panel" role={paired ? 'tabpanel' : undefined} aria-labelledby={paired ? bloch ? 'comparison-bloch-tab' : 'comparison-reference-tab' : undefined} tabIndex={paired ? 0 : undefined}>
        <Scene mode={mode} settings={settings} onStats={onStats} timeline={timeline} prepared={prepared} id="classical" />
      </div>
      <p className="pane-note">{bloch ? 'State amplitudes · dimensionless' : settings.coherentTransition ? <span className="field-legend"><span className="field-electric">E/E₀</span><span className="field-dipole">⟨μ⟩/μ₀</span></span> : settings.superposition ? <span className="component-legend"><i />State 1 <b />State 2</span> : settings.j === 0 ? 'Stationary · J = 0' : 'Continuous deterministic motion'}</p>
    </div>
    {bloch ? <BlochReadouts settings={settings} timeline={timeline} /> : settings.coherentTransition ? <FieldControls settings={settings} timeline={timeline} /> : <ClassicalControls settings={settings} update={update} />}
  </div>
}
