import { useEffect, useState, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import type { QuantumTimeline } from '../physics/evolution'
import { transitionRates, transitionTimeScale, validateTransition } from '../physics/transition'
import { defaultSettings, type Settings } from '../types'
import type { UpdateSettings } from './Controls'
import { MathText, Range, SIValue } from './UI'

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

export function CoherentTransition({ settings: s, update, timeline, maximum, selectTransition, initialControls }: { settings: Settings; update: UpdateSettings; timeline?: QuantumTimeline; maximum: number; selectTransition: (deltaJ: number, deltaM: number) => void; initialControls: ReactNode }) {
  const frame = useQuantumFrame(timeline)
  const validation = validateTransition(s), progress = frame?.progress ?? 0
  const finalPopulation = s.transitionLoop ? Math.sin(Math.PI * progress) ** 2 : progress === 1 ? 1 : Math.sin(Math.PI * progress / 2) ** 2
  const populations = { first: 1 - finalPopulation, second: finalPopulation }
  const finished = !s.transitionLoop && progress >= 1
  const running = s.transitionPlaying && !finished && validation.allowed
  const transportLabel = finished ? 'Replay transition' : running ? 'Pause transition' : progress > 0 ? 'Resume transition' : 'Play transition'
  const rates = transitionRates(s), scale = transitionTimeScale(s)
  const reset = (play: boolean) => { update('transitionProgress', 0); update('transitionRun', s.transitionRun + 1); update('transitionPlaying', play) }
  const carrierAngularRate = Math.abs(rates.resonance) / 1e12
  const rabiMultiple = Number((s.rabiFrequency / carrierAngularRate).toPrecision(12))
  return <div className="coherent-controls" data-testid="coherent-controls">
    <p className="field-caption">INITIAL STATE</p>
    {initialControls}
    <p className="field-caption">TRANSITION</p>
    <div className="transition-choices" role="group" aria-label="Change in J">
      {[1, -1].map(delta => <button key={delta} type="button" aria-pressed={s.j2 - s.j === delta} disabled={s.j + delta < 0 || s.j + delta > maximum} onClick={() => selectTransition(delta, s.m2 - s.m)}>ΔJ = {delta > 0 ? '+1' : '−1'}</button>)}
    </div>
    <div className="transition-choices transition-m-choices" role="group" aria-label="Change in mJ">
      {[1, 0, -1].map(delta => <button key={delta} type="button" aria-pressed={s.m2 - s.m === delta} disabled={Math.abs(s.m + delta) > s.j2} onClick={() => selectTransition(s.j2 - s.j, delta)}>Δm<sub>J</sub> = {delta > 0 ? '+1' : delta < 0 ? '−1' : '0'}</button>)}
    </div>
    <div className="transition-result" data-testid="transition-result" data-j={s.j2} data-m={s.m2} data-polarization={s.polarization}>
      <strong title={s.polarization === 'pi' ? 'Linear z' : 'Circular xy'}>{s.polarization === 'pi' ? 'π' : s.polarization === 'sigmaPlus' ? 'σ+' : 'σ−'}</strong>
      <span>Final state <MathText>{String.raw`\lvert J=${s.j2},\,m_J=${s.m2}\rangle`}</MathText></span>
    </div>
    {!validation.allowed && <p className="transition-validation forbidden" role="status" data-testid="transition-validation">{validation.reason}</p>}
    <div className="transition-transport">
      <button type="button" className="chip transition-playback" aria-label={transportLabel} title={transportLabel} disabled={!validation.allowed} onClick={() => finished ? reset(true) : update('transitionPlaying', !running)}>{running ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}</button>
      <button type="button" className="transition-loop" aria-label="Loop mode" aria-pressed={s.transitionLoop} title="Repeat initial → final → initial. Changing loop mode resets the transition." onClick={() => { update('transitionLoop', !s.transitionLoop); reset(false) }}>Loop mode {s.transitionLoop ? 'ON' : 'OFF'}</button>
      <button type="button" className="chip" onClick={() => reset(false)}>Reset transition</button>
    </div>
    <Range label="Rabi Ω : light ω multiple" value={rabiMultiple} resetValue={0.1} min={0.001} max={1} step="any" display={`${Number(rabiMultiple.toPrecision(3))}×`} physicalValue={<SIValue value={s.rabiFrequency * 1e12 / (2 * Math.PI)} unit="Hz" />} logarithmic onChange={value => update('rabiFrequency', value * carrierAngularRate)} />
    <Range label="Playback speed" value={s.transitionPlayback} resetValue={defaultSettings.transitionPlayback} min={0.1} max={10} step={0.001} display={`${s.transitionPlayback}×`} onChange={value => update('transitionPlayback', value)} physicalValue={`${Number((scale * 1e15).toPrecision(4)).toLocaleString('en-US', { maximumSignificantDigits: 4 })} fs/s`} />
    <Range label={s.transitionLoop ? 'Rabi cycle phase' : 'π-pulse progress'} value={progress * (s.transitionLoop ? 360 : 100)} resetValue={0} min={0} max={s.transitionLoop ? 360 : 100} step={0.1} display={s.transitionLoop ? `${(progress * 360).toFixed(1)}°` : `${(progress * 100).toFixed(1)}%`} minLabel={s.transitionLoop ? '0°' : undefined} maxLabel={s.transitionLoop ? '360°' : undefined} disabled={!validation.allowed} onChange={value => { update('transitionPlaying', false); update('transitionProgress', value / (s.transitionLoop ? 360 : 100)); update('transitionRun', s.transitionRun + 1) }} />
    {s.ensemblePaused && <p className="control-note">Sampling is paused; resume sampling to advance the shared quantum clock. Scrubbing remains available.</p>}
    <div className="transition-populations" data-testid="transition-populations" data-progress={progress} data-time={frame?.time ?? 0}>
      {([['Initial', populations.first], ['Final', populations.second]] as const).map(([name, value]) => <div key={name}><label>{name} <output>{(value * 100).toFixed(1)}%</output></label><progress aria-label={`${name} population`} max={1} value={value} /></div>)}
      <small>Total population: {(populations.first + populations.second).toFixed(6)} · t = {((frame?.time ?? 0) * 1e12).toFixed(4)} ps</small>
    </div>
  </div>
}
