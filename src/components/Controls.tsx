import { ArrowLeft, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { adjacentState, HIGH_J_LIMIT, LOW_J_LIMIT } from '../physics/quantum'
import { defaultSettings, type Settings, type SimulationMode } from '../types'
import { getMolecularParameters, matchesMoleculePreset, MAX_DIPOLE_MOMENT, MIN_TRANSITION_DIPOLE_MOMENT, MOLECULE_PRESETS, type MolecularSettings } from '../physics/molecule'
import { QUANTUM_TIME_SCALE, type QuantumTimeline } from '../physics/evolution'
import { QuantumTime } from './QuantumTime'
import { CoherentTransition } from './CoherentTransition'
import { defaultRabiFrequency, transitionTarget } from '../physics/transition'
import { ControlSection, Range, Reveal, Stepper, Toggle } from './UI'
import { MODE_LABELS, ModePicker } from './ModePicker'
import { useKeyboardShortcut } from '../useKeyboardShortcut'

export type UpdateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) => void
type MoleculeSelection = MolecularSettings & Pick<Settings, 'dipoleMoment'>
type ModeSelection = MoleculeSelection & Pick<Settings, 'j' | 'm' | 'j2' | 'm2' | 'highJ' | 'timeEvolution' | 'quantumPlayback'>

export function Controls({ settings: s, update, setState, timeline, transitionAcknowledged, acknowledgeTransition }: { settings: Settings; update: UpdateSettings; setState: (j: number, m: number) => void; timeline?: QuantumTimeline; transitionAcknowledged: boolean; acknowledgeTransition: () => void }) {
  const noticeButton = useRef<HTMLButtonElement>(null)
  const showNotice = s.coherentTransition && !transitionAcknowledged
  useEffect(() => { if (showNotice) noticeButton.current?.focus() }, [showNotice])
  const maximum = s.highJ && !s.coherentTransition ? HIGH_J_LIMIT : LOW_J_LIMIT
  const snapshot = (): ModeSelection => ({ j: s.j, m: s.m, j2: s.j2, m2: s.m2, highJ: s.highJ, timeEvolution: s.timeEvolution, quantumPlayback: s.quantumPlayback, atomMass: s.atomMass, atomMass2: s.atomMass2, asymmetricBond: s.asymmetricBond, bondLength: s.bondLength, dipoleMoment: s.dipoleMoment })
  const savedModes = useRef<Partial<Record<SimulationMode, ModeSelection>>>({ [s.mode]: snapshot() })
  const previousLowState = useRef({ static: snapshot(), superposition: snapshot() })
  const molecule = getMolecularParameters(s)
  const latestUpdate = useRef(update)
  latestUpdate.current = update
  useLayoutEffect(() => {
    if (s.coherentTransition) latestUpdate.current('rabiFrequency', defaultRabiFrequency(s))
  }, [s.coherentTransition, s.j, s.m, s.j2, s.m2, s.polarization, s.atomMass, s.atomMass2, s.asymmetricBond, s.bondLength, s.dipoleMoment])
  const selectedMolecule = MOLECULE_PRESETS.find(preset => matchesMoleculePreset(s, preset))
  const selectMolecule = (preset: MoleculeSelection) => {
    update('atomMass', preset.atomMass); update('atomMass2', preset.atomMass2); update('asymmetricBond', preset.asymmetricBond); update('bondLength', preset.bondLength); update('dipoleMoment', preset.dipoleMoment)
  }
  const quantumFemtosecondsPerSecond = Number((QUANTUM_TIME_SCALE * s.quantumPlayback * 1e15).toPrecision(6))
  const selectTransition = (deltaJ: number, deltaM: number, j = s.j, m = s.m) => {
    const target = transitionTarget(j, m, deltaJ, deltaM, LOW_J_LIMIT)
    update('j2', target.j2); update('m2', target.m2); update('polarization', target.polarization)
  }
  const selectPrimary = (j: number, m: number) => {
    setState(j, m)
    if (s.coherentTransition) selectTransition(s.j2 - s.j, s.m2 - s.m, j, m)
  }
  const setJ = (j: number) => selectPrimary(j, Math.max(-j, Math.min(j, s.m)))
  const setM = (m: number) => selectPrimary(s.j, m)
  const setHighJ = (enabled: boolean) => {
    if (enabled) {
      if (s.mode === 'transition') return
      previousLowState.current[s.mode] = snapshot()
      update('highJ', true)
    } else {
      if (s.mode === 'transition') return
      const previous = previousLowState.current[s.mode]
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
    const [j, m] = randomState()
    setState(j, m)
    if (s.coherentTransition) {
      const jOptions = [1, -1].filter(delta => j + delta >= 0 && j + delta <= maximum)
      const deltaJ = jOptions[Math.floor(Math.random() * jOptions.length)]
      const mOptions = [1, 0, -1].filter(delta => Math.abs(m + delta) <= j + deltaJ)
      selectTransition(deltaJ, mOptions[Math.floor(Math.random() * mOptions.length)], j, m)
    } else if (s.superposition) {
      const [j2, m2] = randomState()
      update('j2', j2); update('m2', m2)
    }
  }
  const stepState = (direction: -1 | 1) => selectPrimary(...adjacentState(s.j, s.m, direction, maximum))
  useKeyboardShortcut('r', randomizeStates, !showNotice)
  const restore = (selection: ModeSelection) => {
    setState(selection.j, selection.m)
    update('j2', selection.j2); update('m2', selection.m2); update('highJ', selection.highJ)
    update('timeEvolution', selection.timeEvolution); update('quantumPlayback', selection.quantumPlayback)
    selectMolecule(selection)
  }
  const switchMode = (mode: SimulationMode) => {
    if (mode === s.mode) return
    savedModes.current[s.mode] = snapshot()
    update('transitionPlaying', false); update('transitionProgress', 0); update('transitionRun', s.transitionRun + 1)
    const saved = savedModes.current[mode]
    if (saved) restore(saved)
    else if (mode === 'transition') {
      const preset = selectedMolecule?.formula === 'H₂' ? MOLECULE_PRESETS.find(preset => preset.formula === 'CO')! : snapshot()
      restore({ ...snapshot(), ...preset, j: 1, m: 1, j2: 2, m2: 0, highJ: false, dipoleMoment: Math.max(preset.dipoleMoment, MIN_TRANSITION_DIPOLE_MOMENT) })
      update('drivePhase', 0)
    } else {
      const selection = savedModes.current.static ?? snapshot()
      restore(selection)
      previousLowState.current[mode] = { ...previousLowState.current.static }
    }
    if (mode === 'transition') update('polarization', transitionTarget(saved?.j ?? 1, saved?.m ?? 1, saved ? saved.j2 - saved.j : 1, saved ? saved.m2 - saved.m : -1, LOW_J_LIMIT).polarization)
    update('superposition', mode === 'superposition'); update('coherentTransition', mode === 'transition'); update('mode', mode)
  }
  const primaryControls = <div className="state-steppers">
    <div className="quantum-control"><Stepper label="J" value={s.j} min={0} max={maximum} onChange={setJ} /><Range label="J" value={s.j} resetValue={s.coherentTransition ? 1 : s.highJ ? HIGH_J_LIMIT : defaultSettings.j} min={0} max={maximum} onChange={setJ} hideLabel /></div>
    <div className="quantum-control"><Stepper label={<>m<sub>J</sub></>} ariaLabel="mJ" value={s.m} min={-s.j} max={s.j} onChange={setM} /><Range label="mJ" value={s.m} resetValue={s.coherentTransition ? 1 : s.highJ ? HIGH_J_LIMIT : defaultSettings.m} min={-s.j} max={s.j} onChange={setM} disabled={s.j === 0} hideLabel /></div>
  </div>
  const navigationControls = <div className="state-navigation"><div className="state-navigation-half"><button type="button" className="state-step" onClick={() => stepState(-1)}><ArrowLeft size={11} /> Previous</button><button type="button" className="randomize-state" onClick={randomizeStates}>Randomize</button></div><div className="state-navigation-half"><Toggle label="Explore high J" checked={s.highJ && !s.coherentTransition} onChange={setHighJ} showState={false} disabled={s.coherentTransition} title={s.coherentTransition ? 'High J is available in Static and Superposition modes.' : undefined} /><button type="button" className="state-step" onClick={() => stepState(1)}>Next <ArrowRight size={11} /></button></div></div>
  return <aside id="simulation-controls" className="controls-panel" aria-label="Simulation controls">
    <div className="panel-heading"><SlidersHorizontal size={15} /><span>EXPERIMENT CONTROLS</span></div>
    <ModePicker mode={s.mode} onSelect={switchMode} />
    <section className="control-section mode-controls" aria-label={MODE_LABELS[s.mode]}><div className="section-body">
      <div key={s.mode} id="quantum-mode-controls" className="option-reveal mode-module" data-mode={s.mode}>
      <Reveal show={!s.coherentTransition}>
      {s.superposition && <p className="field-caption superposition-caption">FIRST STATE</p>}
      {primaryControls}
      {navigationControls}
      <Reveal show={s.superposition}><div className="quantum-superposition">
      <fieldset id="superposition-controls" className="secondary-state-controls" data-testid="superposition-controls" aria-label="Second state" disabled={!s.superposition}>
        <p className="field-caption superposition-caption">SECOND STATE</p>
        <div className="state-steppers">
          <div className="quantum-control"><Stepper label="J" ariaLabel="Second J" value={s.j2} min={0} max={maximum} onChange={setSecondJ} disabled={!s.superposition} /><Range label="Second J" value={s.j2} resetValue={defaultSettings.j2} min={0} max={maximum} onChange={setSecondJ} disabled={!s.superposition} hideLabel /></div>
          <div className="quantum-control"><Stepper label={<>m<sub>J</sub></>} ariaLabel="Second mJ" value={s.m2} min={-s.j2} max={s.j2} onChange={m => update('m2', m)} disabled={!s.superposition} /><Range label="Second mJ" value={s.m2} resetValue={defaultSettings.m2} min={-s.j2} max={s.j2} onChange={m => update('m2', m)} disabled={!s.superposition || s.j2 === 0} hideLabel /></div>
        </div>

        {s.superposition && s.j === s.j2 && s.m === s.m2 && <p className="control-note">Identical states normalize to a single eigenstate.</p>}
      </fieldset>
      </div></Reveal>
        <div className="evolution-playback-control">
          <Range label="Evolution playback speed" value={s.quantumPlayback} resetValue={defaultSettings.quantumPlayback} min={0.01} max={100} step={0.01} display={`${Number(s.quantumPlayback.toFixed(2))}×`} minLabel="0.01×" maxLabel="100×" logarithmic disabled={!s.timeEvolution} onChange={value => update('quantumPlayback', value)} physicalValue={<span className="evolution-time-scale" data-testid="evolution-time-scale" data-femtoseconds-per-second={quantumFemtosecondsPerSecond} title="Physical molecular time per on-screen simulation second">{quantumFemtosecondsPerSecond.toLocaleString('en-US')} fs/s</span>} companion={<Toggle label="Evolve in time" checked={s.timeEvolution} onChange={value => update('timeEvolution', value)} showState={false} />} />
          {timeline && s.timeEvolution && <QuantumTime timeline={timeline} />}
        </div>
      </Reveal>
      <Reveal id="coherent-transition-controls" show={s.coherentTransition}>
        <div className={`transition-gate${showNotice ? ' awaiting-acknowledgement' : ''}`}>
          <div className="transition-gate-content" inert={showNotice} aria-hidden={showNotice || undefined}>
            <CoherentTransition settings={s} update={update} timeline={timeline} maximum={maximum} selectTransition={selectTransition} initialControls={<>{primaryControls}{navigationControls}</>} />
          </div>
          {showNotice && <section className="transition-notice" aria-labelledby="transition-notice-title">
            <h3 id="transition-notice-title">Visual model only</h3>
            <p id="transition-notice-copy">This model greatly simplifies molecular transitions. Rabi frequencies are exaggerated by orders of magnitude compared with typical experiments. It is only a visual demonstration.</p>
            <button ref={noticeButton} type="button" aria-describedby="transition-notice-copy" onClick={() => { acknowledgeTransition(); document.querySelector<HTMLButtonElement>('.mode-picker-trigger')?.focus() }}>I understand</button>
          </section>}
        </div>
      </Reveal>
      </div>
    </div></section>
    <ControlSection title="Particles & bond" eyebrow="01">
      <div className="molecule-presets" role="group" aria-label="Molecule presets">{MOLECULE_PRESETS.map(preset => <button key={preset.formula} type="button" aria-label={preset.name} title={`${preset.name}: ${preset.atomMass} u / ${preset.atomMass2} u, ${preset.bondLength} Å, ${preset.dipoleMoment} D`} aria-pressed={selectedMolecule === preset} disabled={s.coherentTransition && preset.dipoleMoment === 0} onClick={() => selectMolecule(preset)}>{preset.formula}</button>)}</div>
      <Range label="Particle 1 mass" value={s.atomMass} resetValue={defaultSettings.atomMass} min={0.1} max={200} step={0.01} suffix="u" input logarithmic onChange={value => { update('atomMass', value); if (!s.asymmetricBond) update('atomMass2', value) }} />
      <div className="mass-matching-control">
        <Range label="Particle 2 mass" value={molecule.mass2} resetValue={defaultSettings.atomMass2} min={0.1} max={200} step={0.01} suffix="u" input logarithmic onChange={value => { update('atomMass2', value); update('asymmetricBond', true) }} companion={<Toggle label="Match particle 1" checked={!s.asymmetricBond} showState={false} onChange={match => { update('atomMass2', match ? s.atomMass : molecule.mass2); update('asymmetricBond', !match) }} />} />
      </div>
      <Range label="Bond length" value={s.bondLength} resetValue={defaultSettings.bondLength} min={0.2} max={3} step={0.01} suffix="Å" input onChange={value => update('bondLength', value)} />
      <Range label="Dipole moment" value={s.dipoleMoment} resetValue={defaultSettings.dipoleMoment} min={s.coherentTransition ? MIN_TRANSITION_DIPOLE_MOMENT : 0} max={MAX_DIPOLE_MOMENT} step={0.00001} suffix="D" input logarithmic={false} onChange={value => update('dipoleMoment', value)} />
    </ControlSection>
  </aside>
}
