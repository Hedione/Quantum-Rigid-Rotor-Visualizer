import { Pause, Play, Shuffle } from 'lucide-react'
import { useRef } from 'react'
import { defaultSettings, occlusionDefaults, type EnsembleAppearance, type Settings, type SurfaceQuantity } from '../types'
import { MAX_ROTORS } from '../physics/sampling'
import { ROTOR_PALETTES } from '../rendering/rotors'
import type { UpdateSettings } from './Controls'
import { Range, Toggle } from './UI'
import { CustomRotorColors } from './CustomRotorColors'

type Props = { settings: Settings; update: UpdateSettings }

export function EnsembleControls({ settings: s, update }: Props) {
  const appearance = (settings: Settings): EnsembleAppearance => ({ count: settings.count, frequency: settings.frequency, rotorOpacity: settings.rotorOpacity, ensembleAtomRadius: settings.ensembleAtomRadius })
  const profiles = useRef({ off: appearance(s.particleOcclusion ? defaultSettings : s), on: s.particleOcclusion ? appearance(s) : { ...occlusionDefaults } })
  const setOcclusion = (enabled: boolean) => {
    profiles.current[s.particleOcclusion ? 'on' : 'off'] = appearance(s)
    const next = profiles.current[enabled ? 'on' : 'off']
    update('count', next.count); update('frequency', next.frequency)
    update('rotorOpacity', next.rotorOpacity); update('ensembleAtomRadius', next.ensembleAtomRadius)
    update('particleOcclusion', enabled)
  }
  return <section className="inline-scene-controls ensemble-controls" aria-label="Probability ensemble controls" data-testid="controls-ensemble">
    <div className="scene-controls-heading ensemble-controls-heading">
      <h3>Probability ensemble</h3>
      <div className="button-pair"><button className="action-button" onClick={() => update('ensemblePaused', !s.ensemblePaused)}>{s.ensemblePaused ? <Play size={13} /> : <Pause size={13} />}{s.ensemblePaused ? 'Resume sampling' : 'Pause sampling'}</button><button className="icon-button" title="Regenerate once" aria-label="Regenerate once" onClick={() => update('regenerate', s.regenerate + 1)}><Shuffle size={15} /></button></div>
    </div>
    <div className="scene-controls-body">
      <Range label="Number of Classical Rotors" compactLabel="Rotors" value={s.count} resetValue={defaultSettings.count} min={1} max={MAX_ROTORS} onChange={v => update('count', v)} logarithmic />
      <div className="rotor-opacity-control">
        <Range label="Rotor opacity" compactLabel="Opacity" value={s.rotorOpacity} resetValue={s.particleOcclusion ? occlusionDefaults.rotorOpacity : defaultSettings.rotorOpacity} min={0.005} max={s.particleOcclusion ? 1 : 0.75} step={0.0001} display={`${Number((s.rotorOpacity * 100).toFixed(2))}%`} minLabel="0.5%" maxLabel={s.particleOcclusion ? '100%' : '75%'} logarithmic onChange={v => update('rotorOpacity', v)} companion={<Toggle label="Occlusion" ariaLabel="Particle occlusion" checked={s.particleOcclusion} onChange={setOcclusion} />} />
      </div>
      <Range label="Sampling frequency" compactLabel="Sampling" value={s.frequency} resetValue={s.particleOcclusion ? occlusionDefaults.frequency : defaultSettings.frequency} min={1} max={60} suffix="Hz" onChange={v => update('frequency', v)} />
      <Range label="Atom radius (visualization only)" compactLabel="Visual atomic radius" value={s.ensembleAtomRadius} resetValue={s.particleOcclusion ? occlusionDefaults.ensembleAtomRadius : defaultSettings.ensembleAtomRadius} min={0.5} max={10} step={0.1} suffix="pm" minLabel="0.5 pm" onChange={value => update('ensembleAtomRadius', value)} />
      <div className="ensemble-footer-controls">
        <div className="rotor-palette" role="group" aria-label="Rotor colors">{Object.entries(ROTOR_PALETTES).map(([key, palette]) => <button key={key} type="button" aria-label={palette.label} title={palette.label} aria-pressed={s.rotorPalette === key} onClick={() => update('rotorPalette', key as Settings['rotorPalette'])}><i style={{ background: palette.first }} /><i style={{ background: palette.second }} /><span>{palette.label}</span></button>)}<CustomRotorColors settings={s} update={update} /></div>
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
        ['magnitude', 'Wavefunction', 'ψ'],
        ['probability', 'Probability density', s.superposition || s.timeEvolution ? '|ψ|²' : '|Y|²'],
        ['jointProbability', 'Joint angular probability distribution', '|ψ|² sin θ'],
        ['real', 'Real component', s.superposition || s.timeEvolution ? 'Re(ψ)' : 'Re(Y)'],
        ['imaginary', 'Imaginary component', s.superposition || s.timeEvolution ? 'Im(ψ)' : 'Im(Y)'],
      ] as [SurfaceQuantity, string, string][]).map(([quantity, label, formula]) => <button key={quantity} type="button" aria-label={label} title={quantity === 'magnitude' ? 'Radius shows |ψ|; color shows the complex phase of ψ.' : undefined} aria-pressed={s.surfaceQuantity === quantity} onClick={() => update('surfaceQuantity', quantity)}><span>{label}</span><small>{formula}</small></button>)}</div></div>
    </div>
  </section>
}
