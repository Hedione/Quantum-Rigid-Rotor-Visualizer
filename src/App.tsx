import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Atom, Check, ChevronDown, ChevronRight, Expand, Layers3, MousePointer2, Orbit, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { Controls, type UpdateSettings } from './components/Controls'
import { LiveDiagnostics as Diagnostics } from './components/Diagnostics'
import { PhysicsPanel } from './components/PhysicsPanel'
import { Scene } from './components/Scene'
import { ClassicalControls, EnsembleControls, WavefunctionControls } from './components/SceneControls'
import { MathText } from './components/UI'
import { type SampleStatistics } from './physics/sampling'
import { MAX_HISTOGRAM_BINS } from './physics/histograms'
import { createStatisticsStore } from './store/statistics'
import { useQuantumPreparation } from './preparation/useQuantumPreparation'
import { selectQuantumState } from './preparation/types'
import { defaultSettings, type Settings } from './types'
import { QuantumTimeline } from './physics/evolution'
import { QuantumTime } from './components/QuantumTime'
import { addEffect } from '@react-three/fiber'

const emptyStatistics = (): SampleStatistics => ({
  total: 0, histogram: Array(MAX_HISTOGRAM_BINS).fill(0), currentHistogram: Array(MAX_HISTOGRAM_BINS).fill(0),
  azimuthHistogram: Array(MAX_HISTOGRAM_BINS).fill(0), currentAzimuthHistogram: Array(MAX_HISTOGRAM_BINS).fill(0),
  thetaHistogram: Array(MAX_HISTOGRAM_BINS).fill(0), currentThetaHistogram: Array(MAX_HISTOGRAM_BINS).fill(0),
})

export default function App() {
  const [storedSettings, setSettings] = useState<Settings>(defaultSettings)
  // Fill newly added controls when Vite preserves an older state during refresh.
  const settings: Settings = { ...defaultSettings, ...storedSettings, surfaceQuantity: (storedSettings.surfaceQuantity as string) === 'solidAngle' ? 'jointProbability' : storedSettings.surfaceQuantity ?? defaultSettings.surfaceQuantity }
  const { prepared, pending, error, retry } = useQuantumPreparation(settings)
  const viewSettings: Settings = { ...settings, ...(prepared?.state ?? selectQuantumState(defaultSettings)) }
  const [timeline] = useState(() => new QuantumTimeline())
  const evolving = viewSettings.superposition && viewSettings.timeEvolution
  useLayoutEffect(() => {
    timeline.configure(viewSettings, performance.now())
  }, [timeline, viewSettings.j, viewSettings.m, viewSettings.j2, viewSettings.m2, viewSettings.superposition, viewSettings.timeEvolution, viewSettings.ensemblePaused, viewSettings.quantumPlayback, viewSettings.atomMass, viewSettings.atomMass2, viewSettings.asymmetricBond, viewSettings.bondLength])
  // Fiber runs this once before rendering any canvas, so both quantum views
  // consume exactly the same phase even at large energy differences.
  useEffect(() => evolving ? addEffect(now => timeline.tick(now)) : undefined, [timeline, evolving])
  const [statistics] = useState(() => createStatisticsStore(emptyStatistics()))
  const [fps, setFPS] = useState(0)
  const [fullScreen, setFullScreen] = useState(false)
  const [simulationRun, setSimulationRun] = useState(0)
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const guide = useRef<HTMLDialogElement>(null)
  const update: UpdateSettings = useCallback((key, value) => setSettings(previous => ({ ...previous, [key]: value })), [])
  const setState = useCallback((j: number, m: number) => { setSettings(previous => ({ ...previous, j, m })) }, [])
  const onStats = useCallback((value: SampleStatistics) => statistics.publish(value), [statistics])
  const onFPS = useCallback((value: number) => setFPS(value), [])
  const showGuide = () => {
    if (!guide.current) return
    if (guide.current.open) guide.current.close()
    else guide.current.showModal()
    setGuideOpen(guide.current.open)
  }
  const resetSimulation = () => {
    guide.current?.close()
    timeline.configure(defaultSettings, performance.now())
    statistics.publish(emptyStatistics())
    setSettings({ ...defaultSettings })
    // Restart the clocks, samples, cameras, and chart choices together.
    setSimulationRun(run => run + 1)
    setMobileControlsOpen(false)
    setFPS(0)
    if (error) retry()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  useEffect(() => {
    const handler = () => setFullScreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./" aria-label="Hedione's Rigid Rotor Visualizer home" title="Hedione's Rigid Rotor Visualizer"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><b /></span><span className="brand-copy"><span className="brand-title">Hedione's <em>Rigid Rotor Visualizer</em></span><small className="brand-subtitle">A LITTLE ROTATION. A LOT TO DISCOVER.</small></span></a><div className="header-actions"><span className="local-badge"><i /> LIVE MODEL</span><button className="info-button" type="button" onClick={showGuide} aria-label="About this simulation" title="About this simulation" aria-haspopup="dialog" aria-expanded={guideOpen} aria-controls="simulation-info">i</button><button className="header-reset-button" type="button" onClick={resetSimulation}>RESET SIMULATION</button></div></header>
    <main key={simulationRun}>
      <h1 className="sr-only">Hedione's Rigid Rotor Visualizer</h1>
      <div className="workspace unified-workspace">
        <div className={`sidebar-shell${mobileControlsOpen ? ' is-open' : ''}`}>
          <button className="mobile-controls-toggle" type="button" aria-expanded={mobileControlsOpen} aria-controls="simulation-controls" onClick={() => setMobileControlsOpen(open => !open)}><SlidersHorizontal size={14} /> SIMULATION SETTINGS <ChevronDown size={14} /></button>
          <Controls settings={settings} update={update} setState={setState} />
        </div>
        <div className="center-column">
          <section ref={stage} className="stage unified-stage" aria-label="Unified classical and quantum rotor experiment" aria-busy={pending} data-displayed-j={viewSettings.j} data-displayed-m={viewSettings.m} data-superposition={viewSettings.superposition} data-evolving={evolving} data-displayed-j2={viewSettings.superposition ? viewSettings.j2 : undefined} data-displayed-m2={viewSettings.superposition ? viewSettings.m2 : undefined}>
            <div className="stage-topbar"><div><Layers3 size={12} /><span>THE CLASSICAL–QUANTUM BOUNDARY</span></div><div className="viewport-tools"><button aria-label="Reset camera" title="Reset all cameras" onClick={() => update('cameraReset', settings.cameraReset + 1)}><RotateCcw size={14} /></button><button aria-label={fullScreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Toggle fullscreen" onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen() } catch { /* Fullscreen is optional in embedded browsers. */ } }}><Expand size={14} /></button></div></div>
            <div className="preparation-status" role="status" data-testid="preparation-status">{error ? <><span>Could not update state: {error}</span><button onClick={retry}>Retry</button></> : pending ? <><i className="preparation-spinner" /><span>{settings.superposition ? 'Updating coherent superposition…' : <>Updating J = {settings.j}, m<sub>J</sub> = {settings.m}…</>}</span></> : null}</div>
            <div className="unified-scenes">
              <div className="scene-column classical-column">
              <div className="scene-pane classical-pane" data-testid="pane-classical">
                <div className="pane-label"><Atom size={14} /><span>{viewSettings.superposition ? 'CLASSICAL ROTORS' : 'CLASSICAL ROTOR'}</span><small>{viewSettings.superposition ? 'Two component comparisons' : 'One definite orientation'}</small></div>
                <div className="pane-canvas"><Scene mode="classical" settings={viewSettings} prepared={prepared} onStats={onStats} id="classical" timeline={timeline} /></div>
                <p className="pane-note">{viewSettings.superposition ? <span className="component-legend"><i />State 1 <b />State 2</span> : viewSettings.j === 0 ? 'Stationary · J = 0' : 'Continuous deterministic motion'}</p>
              </div>
              <ClassicalControls settings={settings} update={update} />
              </div>
              <div className="scene-column ensemble-column">
              <div className="scene-pane ensemble-pane" data-testid="pane-ensemble">
                <div className="pane-label"><Layers3 size={15} /><span>QUANTUM PROBABILITY ENSEMBLE</span><small><i className={settings.ensemblePaused ? 'live-dot paused' : 'live-dot'} />{settings.count.toLocaleString()} independent rotors · {settings.frequency} Hz</small></div>
                <div className="pane-canvas"><Scene mode="ensemble" settings={viewSettings} prepared={prepared} onStats={onStats} id="ensemble" onFPS={onFPS} timeline={timeline} /></div>
                <p className="pane-note">{settings.ensemblePaused ? 'Sampling paused' : viewSettings.superposition ? 'Independent samples of |ψ|² dΩ · interference included' : 'Independent samples of |Y|² dΩ'}</p>
              </div>
              <EnsembleControls settings={settings} update={update} />
              </div>
              <div className="scene-column wavefunction-column">
              <div className="scene-pane wavefunction-pane" data-testid="pane-wavefunction">
                <div className="pane-label"><Orbit size={14} /><span>WAVEFUNCTION &amp; PROBABILITY</span><small>{evolving ? <>Time evolution · <QuantumTime timeline={timeline} /></> : viewSettings.superposition ? viewSettings.j === viewSettings.j2 ? 'Stationary coherent superposition' : 'Coherent snapshot · t = 0' : 'Stationary eigenstate'}</small></div>
                <div className="pane-canvas"><Scene mode="wavefunction" settings={viewSettings} prepared={prepared} onStats={onStats} id="wavefunction" timeline={timeline} /></div>
                <div className="pane-phase"><i style={viewSettings.surfaceQuantity === 'jointProbability' ? { background: '#54dfca' } : undefined} /><span>{viewSettings.surfaceQuantity === 'jointProbability' ? 'Joint density · |ψ|² sin θ' : 'Complex phase · −π / 0 / +π'}</span></div>
              </div>
              <WavefunctionControls settings={settings} update={update} />
              </div>
            </div>
            <div className="stage-bottom"><span className="orbit-hint"><MousePointer2 size={13} /> Drag any view to orbit <i /> Scroll to zoom</span><span className="camera-status">{settings.syncCameras ? 'Cameras synchronized' : 'Independent cameras'}</span><span className="fps-indicator"><i />{fps > 0 ? `${fps} FPS` : 'WEBGL'}<span>GPU accelerated</span></span></div>
          </section>
          <Diagnostics j={viewSettings.j} m={viewSettings.m} store={statistics} frequency={settings.histogramFrequency} onFrequencyChange={value => update('histogramFrequency', value)} distribution={prepared?.distribution} evolving={evolving} onReset={() => update('resetStats', settings.resetStats + 1)} />
          <PhysicsPanel settings={viewSettings} />
        </div>
      </div>
    </main>
    <footer className="site-footer"><span><Atom size={13} /> HEDIONE'S RIGID ROTOR VISUALIZER <i /> Built for curiosity.</span><span>J = 0–50 <i /> Condon–Shortley convention <i /> <Check size={11} /> Scientifically grounded</span></footer>
    <dialog ref={guide} id="simulation-info" className="guide-dialog" aria-modal="true" aria-labelledby="simulation-info-title" onClose={() => setGuideOpen(false)} onClick={e => { if (e.target === e.currentTarget) guide.current?.close() }}>
      <button className="dialog-close icon-button" autoFocus onClick={() => guide.current?.close()} aria-label="Close information"><X size={18} /></button>
      <div className="eyebrow">ABOUT THE MODEL</div><h2 id="simulation-info-title">A laboratory for molecular rotation</h2>
      <p>Hedione's Rigid Rotor Visualizer connects the motion of a rotating molecule with its quantum description. Three linked views let you compare classical motion, possible quantum orientations, and the shape of a rotational wavefunction.</p>
      <div className="guide-grid">
        <section><h3>Classical motion</h3><p>Each classical rotor follows a definite trajectory with the energy of its corresponding quantum state. Its atoms rotate about their physical center of mass; changing either mass or the bond length changes its rotational inertia.</p></section>
        <section><h3>Probability ensemble</h3><p>The largest view shows independent samples of possible molecular orientations. Each batch follows the quantum probability, including the solid-angle weight sin θ. Resampling shows a distribution of possibilities rather than molecular trajectories.</p></section>
        <section><h3>Wavefunction &amp; probability</h3><p>Explore normalized complex spherical harmonics, probability density, real and imaginary components, and nodal structures. Superposition mode combines amplitudes, so interference can change the orientation distribution. Time evolution keeps both quantum views on one shared clock.</p></section>
        <section><h3>One shared molecular model</h3><p>Use the sidebar to change J and m<sub>J</sub>, combine states, choose a molecule, or edit particle masses and bond length. The distribution charts compare sampled orientations with theory.</p><MathText block>{String.raw`I=\mu r^2,\qquad E_J=\frac{\hbar^2}{2I}J(J+1)`}</MathText></section>
      </div>
      <p className="guide-callout">A quantum state describes probabilities, not a hidden classical trajectory. Classical rotors provide an energy-matched comparison; coherent superpositions also include interference.</p>
      <p className="guide-small">Drag any view to orbit and scroll to zoom. Double-click a slider to restore its default. RESET SIMULATION restores startup settings, cameras, clocks, and statistics. The classical display runs at 0.1 ps per display second at 1×; quantum evolution runs five times slower. Surface radii are normalized for display. Spherical harmonics use the Condon–Shortley convention.</p>
      <button className="primary-button" onClick={() => guide.current?.close()}>Back to the experiment <ChevronRight size={15} /></button>
    </dialog>
  </div>
}
