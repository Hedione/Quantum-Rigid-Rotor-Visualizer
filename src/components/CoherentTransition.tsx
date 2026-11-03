import { useEffect, useState, type ReactNode } from 'react'
import type { QuantumTimeline } from '../physics/evolution'
import { electricField, POLARIZATIONS, transitionRates, transitionTimeScale, validateTransition } from '../physics/transition'
import { defaultSettings, type Polarization, type Settings } from '../types'
import type { UpdateSettings } from './Controls'
import { Range, Stepper } from './UI'

/** Subscribe only the readouts; animation never updates application Settings. */
export function useQuantumFrame(timeline?: QuantumTimeline) {
  const [frame, setFrame] = useState(() => timeline?.frame)
  useEffect(() => {
    if (!timeline) return
    let handle = 0, previous = -Infinity
    const tick = (now: number) => {
      if (now - previous >= 33) { previous = now; setFrame(timeline.read(now)) }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [timeline])
  return frame
}

export function CoherentTransition({ settings: s, update, timeline, maximum, initialControls }: { settings: Settings; update: UpdateSettings; timeline?: QuantumTimeline; maximum: number; initialControls: ReactNode }) {
  const frame = useQuantumFrame(timeline)
  const validation = validateTransition(s), progress = frame?.progress ?? 0
  const finalPopulation = progress === 1 ? 1 : Math.sin(Math.PI * progress / 2) ** 2
  const populations = { first: 1 - finalPopulation, second: finalPopulation }
  const finished = progress >= 1
  const running = s.transitionPlaying && !finished && validation.allowed
  const rates = transitionRates(s), scale = transitionTimeScale(s)
  const reset = (play: boolean) => { update('transitionProgress', 0); update('transitionRun', s.transitionRun + 1); update('transitionPlaying', play) }
  const field = electricField(s, rates.resonance, frame?.time ?? 0, s.drivePhase)
  return <div className="coherent-controls" data-testid="coherent-controls">
    <p className="field-caption">INITIAL STATE</p>
    {initialControls}
    <p className="field-caption">FINAL STATE</p>
    <div className="state-steppers">
      <div className="quantum-control"><Stepper label="J" ariaLabel="Final J" value={s.j2} min={0} max={maximum} onChange={j => { update('j2', j); update('m2', Math.max(-j, Math.min(j, s.m2))) }} /><Range label="Final J" value={s.j2} resetValue={2} min={0} max={maximum} hideLabel onChange={j => { update('j2', j); update('m2', Math.max(-j, Math.min(j, s.m2))) }} /></div>
      <div className="quantum-control"><Stepper label={<>m<sub>J</sub></>} ariaLabel="Final mJ" value={s.m2} min={-s.j2} max={s.j2} onChange={m => update('m2', m)} /><Range label="Final mJ" value={s.m2} resetValue={0} min={-s.j2} max={s.j2} hideLabel disabled={s.j2 === 0} onChange={m => update('m2', m)} /></div>
    </div>
    <label className="transition-polarization">Polarization<select aria-label="Transition polarization" value={s.polarization} onChange={event => update('polarization', event.target.value as Polarization)}>{POLARIZATIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
    <p className={`transition-validation ${validation.allowed ? 'allowed' : 'forbidden'}`} role="status" data-testid="transition-validation">{validation.allowed ? `Allowed · ΔJ = ${validation.deltaJ > 0 ? '+' : ''}${validation.deltaJ}, Δm = ${validation.deltaM > 0 ? '+' : ''}${validation.deltaM} · ⟨f|C¹q|i⟩ = ${validation.dipole.toFixed(5)}` : validation.reason}</p>
    <Range label="Rabi angular frequency" value={s.rabiFrequency} resetValue={defaultSettings.rabiFrequency} min={0.001} max={10} step={0.001} input suffix="rad/ps" onChange={value => update('rabiFrequency', value)} hint={`Effective Ω includes the dipole coupling. Tπ = ${(Math.PI / s.rabiFrequency).toPrecision(4)} ps; resonance |ω| = ${(Math.abs(rates.resonance) / 1e12).toPrecision(4)} rad/ps.`} />
    <Range label="Drive phase" value={s.drivePhase * 180 / Math.PI} resetValue={0} min={-180} max={180} suffix="°" onChange={value => update('drivePhase', value * Math.PI / 180)} />
    <Range label="Transition playback speed" value={s.transitionPlayback} resetValue={defaultSettings.transitionPlayback} min={0.01} max={100} step={0.01} display={`${s.transitionPlayback}×`} onChange={value => update('transitionPlayback', value)} hint={`${(scale * 1e15).toPrecision(4)} fs of physical time / display s${scale < 2e-14 * s.transitionPlayback ? ' · capped to resolve laboratory phase' : ''}.`} />
    <Range label="π-pulse progress" value={progress * 100} resetValue={0} min={0} max={100} step={0.1} display={`${(progress * 100).toFixed(1)}%`} disabled={!validation.allowed} onChange={value => { update('transitionPlaying', false); update('transitionProgress', value / 100); update('transitionRun', s.transitionRun + 1) }} />
    <div className="transition-transport">
      <button type="button" className="chip" disabled={!validation.allowed} onClick={() => finished ? reset(true) : update('transitionPlaying', !running)}>{finished ? 'Replay transition' : running ? 'Pause transition' : progress > 0 ? 'Resume transition' : 'Play transition'}</button>
      <button type="button" className="chip" onClick={() => reset(false)}>Reset transition</button>
    </div>
    {s.ensemblePaused && <p className="control-note">Sampling is paused; resume sampling to advance the shared quantum clock. Scrubbing remains available.</p>}
    <div className="transition-populations" data-testid="transition-populations" data-progress={progress} data-time={frame?.time ?? 0}>
      {([['Initial', populations.first], ['Final', populations.second]] as const).map(([name, value]) => <div key={name}><label>{name} <output>{(value * 100).toFixed(1)}%</output></label><progress aria-label={`${name} population`} max={1} value={value} /></div>)}
      <small>Total population: {(populations.first + populations.second).toFixed(6)} · t = {((frame?.time ?? 0) * 1e12).toFixed(4)} ps</small>
    </div>
    <div className="transition-field" aria-label="Driving electric field" data-x={field.x} data-y={field.y} data-z={field.z}>
      <svg viewBox="0 0 100 100" role="img" aria-label={s.polarization === 'pi' ? 'Electric field along z; propagation along x' : 'Electric field in xy; propagation along positive z; viewed from positive z toward the origin'}>
        <path d="M10 50H90M50 90V10" /><text x="90" y="62">x</text><text x="55" y="12">{s.polarization === 'pi' ? 'z' : 'y'}</text>
        <line x1="50" y1="50" x2={50 + 32 * field.x} y2={50 - 32 * (s.polarization === 'pi' ? field.z : field.y)} />
        <circle cx={50 + 32 * field.x} cy={50 - 32 * (s.polarization === 'pi' ? field.z : field.y)} r="3" />
      </svg>
      <p className="control-note">{s.polarization === 'pi' ? 'E ∥ z; propagation +x.' : 'E in xy; propagation +z. View from +z toward the origin. σ+ rotates +x toward +y for absorption; σ− reverses. Emission reverses the rotation for the same Δm.'}</p>
    </div>
    <details className="transition-convention"><summary>Phase &amp; two-level model</summary><p className="control-note">Exact resonance, isolated polar linear rotor; no relaxation. A permanent dipole is assumed independently of the mass presets. Ω is the effective coupling, not an inferred field strength. The drive phase is defined by Hⁱfi = ℏΩ exp(iφd)/2, including the signed dipole. ci = cos(Ωt/2), cf = −i exp(iφd) sin(Ωt/2); both retain exp(−iEt/ℏ). C¹₀ = cos θ, C¹±₁ = ∓sin θ exp(±iφ)/√2. E/E₀ = (cos α, q sin α, 0) for circular; (0, 0, cos α) for π, with α = (Ef−Ei)t/ℏ − φE. φE includes the coupling sign from −μ·E. Playback slows physical time without removing dynamical phase. A degenerate rotor can couple additional m states in a real experiment; isolation is an ideal two-level assumption.</p></details>
  </div>
}
