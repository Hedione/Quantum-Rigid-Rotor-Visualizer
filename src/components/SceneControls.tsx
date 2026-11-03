import { Pause, Play, Shuffle } from 'lucide-react'
import { defaultSettings, type Settings, type SurfaceQuantity } from '../types'
import { MAX_ROTORS } from '../physics/sampling'
import { ROTOR_PALETTES } from '../rendering/rotors'
import type { UpdateSettings } from './Controls'
import { Range, Reveal, Toggle } from './UI'

type Props = { settings: Settings; update: UpdateSettings }

export function EnsembleControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls ensemble-controls" aria-label="Probability ensemble controls" data-testid="controls-ensemble">
    <div className="scene-controls-heading ensemble-controls-heading">
      <h3>Probability ensemble</h3>
      <div className="button-pair"><button className="action-button" onClick={() => update('ensemblePaused', !s.ensemblePaused)}>{s.ensemblePaused ? <Play size={13} /> : <Pause size={13} />}{s.ensemblePaused ? 'Resume sampling' : 'Pause sampling'}</button><button className="icon-button" title="Regenerate once" aria-label="Regenerate once" onClick={() => update('regenerate', s.regenerate + 1)}><Shuffle size={15} /></button></div>
    </div>
    <div className="scene-controls-body">
      <Range label="Number of Classical Rotors" compactLabel="Rotors" value={s.count} resetValue={defaultSettings.count} min={1} max={MAX_ROTORS} onChange={v => update('count', v)} input logarithmic />
      <div className="slider-toggle-control rotor-opacity-control">
        <Range label="Rotor opacity" compactLabel="Opacity" value={s.particleOcclusion ? 1 : s.rotorOpacity} resetValue={defaultSettings.rotorOpacity} min={0.005} max={s.particleOcclusion ? 1 : 0.75} step={0.0001} display={s.particleOcclusion ? '100%' : `${Number((s.rotorOpacity * 100).toFixed(2))}%`} minLabel="0.5%" maxLabel={s.particleOcclusion ? '100%' : '75%'} logarithmic disabled={s.particleOcclusion} onChange={v => update('rotorOpacity', v)} />
        <Toggle label="Occlusion" ariaLabel="Particle occlusion" checked={s.particleOcclusion} onChange={value => update('particleOcclusion', value)} />
      </div>
      <Range label="Sampling frequency" compactLabel="Sampling" value={s.frequency} resetValue={defaultSettings.frequency} min={1} max={60} suffix="Hz" onChange={v => update('frequency', v)} />
      <Range label="Atom radius (visualization only)" compactLabel="Visual radius" value={s.ensembleAtomRadius} resetValue={defaultSettings.ensembleAtomRadius} min={0.5} max={10} step={0.1} suffix="pm" minLabel="0.5 pm" onChange={value => update('ensembleAtomRadius', value)} />
      <div className="ensemble-footer-controls">
        <div className="rotor-palette" role="group" aria-label="Rotor colors">{Object.entries(ROTOR_PALETTES).map(([key, palette]) => <button key={key} type="button" aria-label={palette.label} title={palette.label} aria-pressed={s.rotorPalette === key} onClick={() => update('rotorPalette', key as Settings['rotorPalette'])}><i style={{ background: palette.first }} /><i style={{ background: palette.second }} /><span>{palette.label}</span></button>)}</div>
      </div>
    </div>
  </section>
}

export function ClassicalControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls" aria-label="Classical rotor controls" data-testid="controls-classical">
    <h3 className="scene-controls-heading">Classical motion</h3>
    <div className="scene-controls-body">
      <Range label="Playback speed" value={s.playback} resetValue={defaultSettings.playback} min={0.01} max={3} step={0.01} display={`${Number(s.playback.toFixed(2))}×`} minLabel="0.01×" maxLabel="3×" onChange={v => update('playback', v)} />
      {s.j === 0 && (!s.superposition || s.j2 === 0) && <p className="control-note">J = 0: no rotation; the angular momentum direction is undefined.</p>}
    </div>
  </section>
}

export function WavefunctionControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls" aria-label="Wavefunction and probability controls" data-testid="controls-wavefunction">
    <h3 className="scene-controls-heading">Wavefunction &amp; probability</h3>
    <div className="scene-controls-body">
      <div className="radial-quantity"><span>Radial quantity</span><div className="radial-buttons" role="group" aria-label="Radial quantity">{([
        ['magnitude', 'Magnitude', s.superposition || s.timeEvolution ? '|ψ|' : '|Y|'],
        ['probability', 'Probability density', s.superposition || s.timeEvolution ? '|ψ|²' : '|Y|²'],
        ['jointProbability', 'Joint angular probability distribution', '|ψ|² sin θ'],
        ['real', 'Real component', s.superposition || s.timeEvolution ? 'Re(ψ)' : 'Re(Y)'],
        ['imaginary', 'Imaginary component', s.superposition || s.timeEvolution ? 'Im(ψ)' : 'Im(Y)'],
      ] as [SurfaceQuantity, string, string][]).map(([quantity, label, formula]) => <button key={quantity} type="button" aria-label={label} aria-pressed={s.surfaceQuantity === quantity} onClick={() => update('surfaceQuantity', quantity)}><span>{label}</span><small>{formula}</small></button>)}</div></div>
      <Reveal show={!s.superposition}><Toggle label="Show nodal structures" checked={s.nodes} onChange={v => update('nodes', v)} /></Reveal>
    </div>
  </section>
}
