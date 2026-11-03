import { ArrowLeft, ArrowRight, Shuffle, SlidersHorizontal } from 'lucide-react'
import { useRef } from 'react'
import { adjacentState, HIGH_J_LIMIT, LOW_J_LIMIT } from '../physics/quantum'
import { defaultSettings, type Settings } from '../types'
import { getMolecularParameters, MOLECULE_PRESETS } from '../physics/molecule'
import { QUANTUM_TIME_SCALE, type QuantumTimeline } from '../physics/evolution'
import { QuantumTime } from './QuantumTime'
import { CoherentTransition } from './CoherentTransition'
import { ControlSection, PermanentControlSection, Range, Reveal, Stepper, Toggle } from './UI'

export type UpdateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) => void

export function Controls({ settings: s, update, setState, timeline }: { settings: Settings; update: UpdateSettings; setState: (j: number, m: number) => void; timeline?: QuantumTimeline }) {
  const maximum = s.highJ ? HIGH_J_LIMIT : LOW_J_LIMIT
  const previousLowState = useRef({ j: defaultSettings.j, m: defaultSettings.m, j2: defaultSettings.j2, m2: defaultSettings.m2 })
  const transitionInitialized = useRef(false)
  const molecule = getMolecularParameters(s)
  const quantumFemtosecondsPerSecond = Number((QUANTUM_TIME_SCALE * s.quantumPlayback * 1e15).toPrecision(6))
  const setJ = (j: number) => setState(j, Math.max(-j, Math.min(j, s.m)))
  const setM = (m: number) => setState(s.j, m)
  const setHighJ = (enabled: boolean) => {
    if (enabled) {
      previousLowState.current = { j: s.j, m: s.m, j2: s.j2, m2: s.m2 }
      update('highJ', true); setState(HIGH_J_LIMIT, HIGH_J_LIMIT)
    } else {
      const previous = previousLowState.current
      update('highJ', false); setState(previous.j, previous.m)
      update('j2', previous.j2); update('m2', previous.m2)
    }
  }
  const setSecondJ = (j: number) => { update('j2', j); update('m2', Math.max(-j, Math.min(j, s.m2))) }
  const randomState = (): [number, number] => {
    const j = Math.floor(Math.random() * (maximum + 1))
    return [j, Math.floor(Math.random() * (2 * j + 1)) - j]
  }
  const randomizeStates = () => {
    const [j, m] = randomState(), [j2, m2] = randomState()
    setState(j, m); update('j2', j2); update('m2', m2)
  }
  const stepState = (direction: -1 | 1) => setState(...adjacentState(s.j, s.m, direction, maximum))
  const switchQuantumMode = () => {
    const transition = !s.coherentTransition
    update('coherentTransition', transition); update('transitionPlaying', false)
    if (transition) {
      update('superposition', false); update('transitionProgress', 0); update('transitionRun', s.transitionRun + 1)
      if (!transitionInitialized.current) { setState(1, 1); update('j2', 2); update('m2', 0); update('polarization', 'sigmaMinus'); transitionInitialized.current = true }
    }
  }
  const primaryControls = <div className="state-steppers">
    <div className="quantum-control"><Stepper label="J" value={s.j} min={0} max={maximum} onChange={setJ} /><Range label="J" value={s.j} resetValue={s.coherentTransition ? 1 : s.highJ ? HIGH_J_LIMIT : defaultSettings.j} min={0} max={maximum} onChange={setJ} hideLabel /></div>
    <div className="quantum-control"><Stepper label={<>m<sub>J</sub></>} ariaLabel="mJ" value={s.m} min={-s.j} max={s.j} onChange={setM} /><Range label="mJ" value={s.m} resetValue={s.coherentTransition ? 1 : s.highJ ? HIGH_J_LIMIT : defaultSettings.m} min={-s.j} max={s.j} onChange={setM} disabled={s.j === 0} hideLabel /></div>
  </div>
  const navigationControls = <div className="state-navigation"><button type="button" className="state-step" onClick={() => stepState(-1)}><ArrowLeft size={11} /> Previous</button><Toggle label="Enable J > 10" checked={s.highJ} onChange={setHighJ} showState={false} /><button type="button" className="state-step" onClick={() => stepState(1)}>Next <ArrowRight size={11} /></button></div>
  return <aside id="simulation-controls" className="controls-panel" aria-label="Simulation controls">
    <div className="panel-heading"><SlidersHorizontal size={15} /><span>EXPERIMENT CONTROLS</span></div>
    <PermanentControlSection title="Quantum state" eyebrow="01" action={<button type="button" className="quantum-mode-switch" aria-controls="quantum-mode-controls" onClick={switchQuantumMode}>Switch to {s.coherentTransition ? 'Static' : 'Transition'} mode</button>}>
      <div id="quantum-mode-controls" data-mode={s.coherentTransition ? 'transition' : 'static'}>
      <Reveal show={!s.coherentTransition}>
      {primaryControls}
      {navigationControls}
        <div className="evolution-playback-control">
          <Range label="Evolution playback speed" value={s.quantumPlayback} resetValue={defaultSettings.quantumPlayback} min={0.01} max={100} step={0.01} display={`${Number(s.quantumPlayback.toFixed(2))}×`} minLabel="0.01×" maxLabel="100×" logarithmic disabled={!s.timeEvolution} onChange={value => update('quantumPlayback', value)} hint={<span className="evolution-time-scale" data-testid="evolution-time-scale" data-femtoseconds-per-second={quantumFemtosecondsPerSecond} title="Physical molecular time per on-screen simulation second">{quantumFemtosecondsPerSecond.toLocaleString('en-US')} fs<sub>real</sub> / s<sub>sim</sub></span>} companion={<Toggle label="Evolve in time" checked={s.timeEvolution} onChange={value => update('timeEvolution', value)} showState={false} />} />
          {timeline && s.timeEvolution && <QuantumTime timeline={timeline} />}
        </div>
      <div className="quantum-superposition">
      <Toggle label="Superposition mode" checked={s.superposition} onChange={value => update('superposition', value)} controls="superposition-controls" />
      <Reveal id="superposition-controls" show={s.superposition}>
      <div data-testid="superposition-controls">
        <p className="field-caption superposition-caption">SECOND STATE</p>
        <div className="state-steppers">
          <div className="quantum-control"><Stepper label="J" ariaLabel="Second J" value={s.j2} min={0} max={maximum} onChange={setSecondJ} /><Range label="Second J" value={s.j2} resetValue={defaultSettings.j2} min={0} max={maximum} onChange={setSecondJ} hideLabel /></div>
          <div className="quantum-control"><Stepper label={<>m<sub>J</sub></>} ariaLabel="Second mJ" value={s.m2} min={-s.j2} max={s.j2} onChange={m => update('m2', m)} /><Range label="Second mJ" value={s.m2} resetValue={defaultSettings.m2} min={-s.j2} max={s.j2} onChange={m => update('m2', m)} disabled={s.j2 === 0} hideLabel /></div>
        </div>

        {s.j === s.j2 && s.m === s.m2 && <p className="control-note">Identical states normalize to a single eigenstate.</p>}
        <p className="field-caption superposition-caption">TRY A SUPERPOSITION</p>
        <div className="superposition-examples">
          {[{ j: 1, label: 'Two lobes' }, { j: 2, label: 'Four lobes' }].map(example => <button key={example.j} onClick={() => { setState(example.j, example.j); update('j2', example.j); update('m2', -example.j) }}><span>{example.label}</span><small>({example.j}, +{example.j}) + ({example.j}, −{example.j})</small></button>)}
          <button type="button" onClick={randomizeStates} title={`Randomize both states within J = 0–${maximum}`}><span>Randomize both states</span><Shuffle size={13} aria-hidden="true" /></button>
        </div>
      </div>
      </Reveal>
      </div>
      </Reveal>
      <Reveal id="coherent-transition-controls" show={s.coherentTransition}><CoherentTransition settings={s} update={update} timeline={timeline} maximum={maximum} initialControls={<>{primaryControls}{navigationControls}</>} /></Reveal>
      </div>
    </PermanentControlSection>
    <ControlSection title="Particles & bond" eyebrow="02">
      <div className="molecule-presets" role="group" aria-label="Molecule presets">{MOLECULE_PRESETS.map(preset => <button key={preset.formula} type="button" aria-label={preset.name} title={`${preset.name}: ${preset.atomMass} u / ${preset.atomMass2} u, ${preset.bondLength} Å`} aria-pressed={s.atomMass === preset.atomMass && molecule.mass2 === preset.atomMass2 && s.bondLength === preset.bondLength && s.asymmetricBond === preset.asymmetricBond} onClick={() => {
        update('atomMass', preset.atomMass); update('atomMass2', preset.atomMass2); update('asymmetricBond', preset.asymmetricBond); update('bondLength', preset.bondLength)
      }}>{preset.formula}</button>)}</div>
      <Range label="Particle 1 mass" value={s.atomMass} resetValue={defaultSettings.atomMass} min={0.1} max={200} step={0.01} suffix="u" input logarithmic onChange={value => { update('atomMass', value); if (!s.asymmetricBond) update('atomMass2', value) }} />
      <div className="mass-matching-control">
        <Range label="Particle 2 mass" value={molecule.mass2} resetValue={defaultSettings.atomMass2} min={0.1} max={200} step={0.01} suffix="u" input logarithmic onChange={value => { update('atomMass2', value); update('asymmetricBond', true) }} companion={<Toggle label="Match particle 1" checked={!s.asymmetricBond} showState={false} onChange={match => { update('atomMass2', match ? s.atomMass : molecule.mass2); update('asymmetricBond', !match) }} />} />
      </div>
      <Range label="Bond length" value={s.bondLength} resetValue={defaultSettings.bondLength} min={0.2} max={3} step={0.01} suffix="Å" input onChange={value => update('bondLength', value)} />
      <Reveal id="mass-center-note" show={s.asymmetricBond}>
        <p className="control-note">Rotation stays centered on the center of mass. Particle distances: {(s.bondLength * molecule.firstFraction).toFixed(3)} Å / {(s.bondLength * molecule.secondFraction).toFixed(3)} Å.</p>
      </Reveal>
    </ControlSection>
  </aside>
}
