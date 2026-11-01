import { ArrowLeft, ArrowRight, Shuffle, SlidersHorizontal } from 'lucide-react'
import { adjacentState, HIGH_J_LIMIT, LOW_J_LIMIT } from '../physics/quantum'
import { defaultSettings, type Settings } from '../types'
import { ControlSection, MathText, PermanentControlSection, Range, Stepper, Toggle } from './UI'

export type UpdateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) => void

export function Controls({ settings: s, update, setState }: { settings: Settings; update: UpdateSettings; setState: (j: number, m: number) => void }) {
  const maximum = s.highJ ? HIGH_J_LIMIT : LOW_J_LIMIT
  const setJ = (j: number) => setState(j, s.followStretched ? j : Math.max(-j, Math.min(j, s.m)))
  const setM = (m: number) => { update('followStretched', false); setState(s.j, m) }
  const setSecondJ = (j: number) => { update('j2', j); update('m2', Math.max(-j, Math.min(j, s.m2))) }
  const randomState = (): [number, number] => {
    const j = Math.floor(Math.random() * (maximum + 1))
    return [j, Math.floor(Math.random() * (2 * j + 1)) - j]
  }
  const randomizeStates = () => {
    const [j, m] = randomState(), [j2, m2] = randomState()
    update('followStretched', false)
    setState(j, m); update('j2', j2); update('m2', m2)
  }
  const stepState = (direction: -1 | 1) => {
    if (s.followStretched) { const j = (s.j + direction + maximum + 1) % (maximum + 1); setState(j, j) }
    else setState(...adjacentState(s.j, s.m, direction, maximum))
  }
  return <aside className="controls-panel" aria-label="Simulation controls">
    <div className="panel-heading"><SlidersHorizontal size={15} /><span>EXPERIMENT CONTROLS</span></div>
    <PermanentControlSection title="Quantum state" eyebrow="01">
      <div className="state-steppers">
        <div className="quantum-control"><Stepper label="J" value={s.j} min={0} max={maximum} onChange={setJ} /><Range label="J" value={s.j} resetValue={s.highJ ? HIGH_J_LIMIT : defaultSettings.j} min={0} max={maximum} onChange={setJ} hideLabel /></div>
        <div className="quantum-control"><Stepper label={<>m<sub>J</sub></>} ariaLabel="mJ" value={s.m} min={-s.j} max={s.j} onChange={setM} /><Range label="mJ" value={s.m} resetValue={s.highJ ? HIGH_J_LIMIT : defaultSettings.m} min={-s.j} max={s.j} onChange={setM} disabled={s.j === 0} hideLabel /></div>
      </div>
      <div className="state-navigation"><button onClick={() => stepState(-1)}><ArrowLeft size={13} /> Previous</button><button onClick={() => stepState(1)}>Next state <ArrowRight size={13} /></button></div>
      <Toggle label={`Explore high J (up to ${HIGH_J_LIMIT})`} checked={s.highJ} onChange={enabled => {
        update('highJ', enabled); update('followStretched', false)
        if (enabled) { setState(HIGH_J_LIMIT, HIGH_J_LIMIT) }
        else {
          const j = Math.min(LOW_J_LIMIT, s.j), j2 = Math.min(LOW_J_LIMIT, s.j2)
          setState(j, Math.max(-j, Math.min(j, s.m))); update('j2', j2); update('m2', Math.max(-j2, Math.min(j2, s.m2)))
        }
      }} />
      {s.highJ && <>
        <Toggle label={<>Follow m<sub>J</sub> = J</>} ariaLabel="Follow mJ = J" checked={s.followStretched} onChange={enabled => { update('followStretched', enabled); if (enabled) setState(s.j, s.j) }} />
        <p className="control-note high-j-note">Increase J with m<sub>J</sub> = J to concentrate the ensemble around the classical rotation plane. The quantum density stays stationary. All J values use the same display clock.</p>
      </>}
    </PermanentControlSection>
    <PermanentControlSection title="Superposition mode" eyebrow="02" action={<button className="superposition-enable" type="button" aria-expanded={s.superposition} aria-controls="superposition-controls" onClick={() => update('superposition', !s.superposition)}>{s.superposition ? 'Disable' : 'Enable'}</button>}>
      {s.superposition && <div id="superposition-controls" data-testid="superposition-controls">
        <p className="field-caption superposition-caption">SECOND STATE</p>
        <div className="state-steppers">
          <div className="quantum-control"><Stepper label="J" ariaLabel="Second J" value={s.j2} min={0} max={maximum} onChange={setSecondJ} /><Range label="Second J" value={s.j2} resetValue={defaultSettings.j2} min={0} max={maximum} onChange={setSecondJ} hideLabel /></div>
          <div className="quantum-control"><Stepper label={<>m<sub>J</sub></>} ariaLabel="Second mJ" value={s.m2} min={-s.j2} max={s.j2} onChange={m => update('m2', m)} /><Range label="Second mJ" value={s.m2} resetValue={defaultSettings.m2} min={-s.j2} max={s.j2} onChange={m => update('m2', m)} disabled={s.j2 === 0} hideLabel /></div>
        </div>
        <Toggle label="Evolve in time" checked={s.timeEvolution} onChange={value => update('timeEvolution', value)} hint="Pause sampling freezes quantum evolution." />
        {s.timeEvolution && <Range label="Evolution playback speed" value={s.quantumPlayback} resetValue={defaultSettings.quantumPlayback} min={0.01} max={5} step={0.01} display={`${Number(s.quantumPlayback.toFixed(2))}×`} minLabel="0.01×" maxLabel="5×" onChange={value => update('quantumPlayback', value)} />}
        <MathText block>{s.timeEvolution ? s.j === s.j2 && s.m === s.m2 ? String.raw`\psi(t)=Y_{${s.j}}^{${s.m}}e^{-iE_Jt/\hbar}` : String.raw`\psi(t)=\frac{Y_1e^{-iE_1t/\hbar}+Y_2e^{-iE_2t/\hbar}}{\sqrt{2}}` : s.j === s.j2 && s.m === s.m2 ? String.raw`\psi=Y_{${s.j}}^{${s.m}}` : String.raw`\psi=\frac{Y_{${s.j}}^{${s.m}}+Y_{${s.j2}}^{${s.m2}}}{\sqrt{2}}`}</MathText>
        {s.j !== s.j2 && <p className="control-note">{s.timeEvolution ? 'Different energies create a changing relative phase and interference pattern.' : 'Different J values would evolve in time; this snapshot keeps the interference visible.'}</p>}
        {s.timeEvolution && s.j === s.j2 && <p className="control-note">Equal energies: probability stays stationary while the complex phase evolves.</p>}
        {s.j === s.j2 && s.m === s.m2 && <p className="control-note">Identical states normalize to a single eigenstate.</p>}
        <p className="field-caption superposition-caption">TRY A SUPERPOSITION</p>
        <div className="superposition-examples">
          {[{ j: 1, label: 'Two lobes' }, { j: 2, label: 'Four lobes' }].map(example => <button key={example.j} onClick={() => { update('followStretched', false); setState(example.j, example.j); update('j2', example.j); update('m2', -example.j) }}><span>{example.label}</span><small>({example.j}, +{example.j}) + ({example.j}, −{example.j})</small></button>)}
          <button type="button" onClick={randomizeStates} title={`Randomize both states within J = 0–${maximum}`}><span>Randomize both states</span><Shuffle size={13} aria-hidden="true" /></button>
        </div>
      </div>}
    </PermanentControlSection>
    <ControlSection title="Scene settings">
      <Toggle label="z axis" checked={s.zAxis} onChange={v => update('zAxis', v)} />
      <Toggle label="Synchronize cameras" checked={s.syncCameras} onChange={v => update('syncCameras', v)} />
    </ControlSection>
  </aside>
}
