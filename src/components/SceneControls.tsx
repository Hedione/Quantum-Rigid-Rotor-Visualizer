import { Pause, Play, Shuffle } from 'lucide-react'
import { defaultSettings, type Settings, type SurfaceQuantity } from '../types'
import { MAX_ROTORS } from '../physics/sampling'
import type { UpdateSettings } from './Controls'
import { Range, Toggle } from './UI'

type Props = { settings: Settings; update: UpdateSettings }

export function EnsembleControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls ensemble-controls" aria-label="Probability ensemble controls" data-testid="controls-ensemble">
    <h3 className="scene-controls-heading">Probability ensemble</h3>
    <div className="scene-controls-body">
      <Range label="Number of Classical Rotors" value={s.count} resetValue={defaultSettings.count} min={1} max={MAX_ROTORS} onChange={v => update('count', v)} input logarithmic />
      <Range label="Rotor opacity" value={s.rotorOpacity} resetValue={defaultSettings.rotorOpacity} min={0.005} max={0.75} step={0.0001} display={`${Number((s.rotorOpacity * 100).toFixed(2))}%`} minLabel="0.5%" maxLabel="75%" logarithmic onChange={v => update('rotorOpacity', v)} />
      <Range label="Sampling frequency" value={s.frequency} resetValue={defaultSettings.frequency} min={1} max={60} suffix="Hz" onChange={v => update('frequency', v)} />
      <div className="button-pair"><button className="action-button" onClick={() => update('ensemblePaused', !s.ensemblePaused)}>{s.ensemblePaused ? <Play size={13} /> : <Pause size={13} />}{s.ensemblePaused ? 'Resume sampling' : 'Pause sampling'}</button><button className="icon-button" title="Regenerate once" aria-label="Regenerate once" onClick={() => update('regenerate', s.regenerate + 1)}><Shuffle size={15} /></button></div>
      <p className="control-note"><strong>Independent Monte Carlo samples.</strong> Each batch is a new draw from {s.superposition ? '|ψ|² dΩ, including interference' : '|Y|² dΩ'}. These dumbbells do not trace classical trajectories.</p>
    </div>
  </section>
}

export function ClassicalControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls" aria-label="Classical rotor controls" data-testid="controls-classical">
    <h3 className="scene-controls-heading">Classical motion</h3>
    <div className="scene-controls-body">
      <Range label="Playback speed" value={s.playback} resetValue={defaultSettings.playback} min={0.01} max={3} step={0.01} display={`${Number(s.playback.toFixed(2))}×`} minLabel="0.01×" maxLabel="3×" onChange={v => update('playback', v)} />
      <p className="control-note">{s.j === 0 && (!s.superposition || s.j2 === 0) ? 'J = 0: no rotation; the angular momentum direction is undefined.' : <>Polar angles stay fixed by J and m<sub>J</sub>.</>}</p>
    </div>
  </section>
}

export function WavefunctionControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls" aria-label="Wavefunction and probability controls" data-testid="controls-wavefunction">
    <h3 className="scene-controls-heading">Wavefunction &amp; probability</h3>
    <div className="scene-controls-body">
      <div className="radial-quantity"><span>Radial quantity</span><div className="radial-buttons" role="group" aria-label="Radial quantity">{([
        ['magnitude', 'Magnitude', s.superposition ? '|ψ|' : '|Y|'],
        ['probability', 'Probability density', s.superposition ? '|ψ|²' : '|Y|²'],
        ['jointProbability', 'Joint angular probability distribution', '|ψ|² sin θ'],
        ['real', 'Real component', s.superposition ? 'Re(ψ)' : 'Re(Y)'],
        ['imaginary', 'Imaginary component', s.superposition ? 'Im(ψ)' : 'Im(Y)'],
      ] as [SurfaceQuantity, string, string][]).map(([quantity, label, formula]) => <button key={quantity} type="button" aria-label={label} aria-pressed={s.surfaceQuantity === quantity} onClick={() => update('surfaceQuantity', quantity)}><span>{label}</span><small>{formula}</small></button>)}</div></div>
      {s.surfaceQuantity !== 'jointProbability' && <Toggle label="Color by complex phase" checked={s.phaseColor} onChange={v => update('phaseColor', v)} />}
      {!s.superposition && <Toggle label="Show nodal structures" checked={s.nodes} onChange={v => update('nodes', v)} />}
      <p className="control-note">{s.surfaceQuantity === 'jointProbability' ? 'Joint density per dθ dφ: |ψ|² sin θ. Both angles and their interference are retained, with no integration over φ. Radius is normalized for display.' : 'Radius is normalized within each state. Color encodes phase; orientations are sampled with the solid-angle weight sin θ.'}</p>
      {s.superposition && s.timeEvolution && <p className="control-note">Time evolution uses a fixed radial scale so changes in density remain visible.</p>}
    </div>
  </section>
}
