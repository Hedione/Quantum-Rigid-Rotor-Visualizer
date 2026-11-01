import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Atom, BookOpen, Check, ChevronRight, Expand, Layers3, MousePointer2, Orbit, RotateCcw, X } from 'lucide-react'
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
  }, [timeline, viewSettings.j, viewSettings.m, viewSettings.j2, viewSettings.m2, viewSettings.superposition, viewSettings.timeEvolution, viewSettings.ensemblePaused, viewSettings.quantumPlayback, viewSettings.atomMass, viewSettings.bondLength])
  // Fiber runs this once before rendering any canvas, so both quantum views
  // consume exactly the same phase even at large energy differences.
  useEffect(() => evolving ? addEffect(now => timeline.tick(now)) : undefined, [timeline, evolving])
  const [statistics] = useState(() => createStatisticsStore(emptyStatistics()))
  const [fps, setFPS] = useState(0)
  const [fullScreen, setFullScreen] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const guide = useRef<HTMLDialogElement>(null)
  const update: UpdateSettings = useCallback((key, value) => setSettings(previous => ({ ...previous, [key]: value })), [])
  const setState = useCallback((j: number, m: number) => { setSettings(previous => ({ ...previous, j, m })) }, [])
  const onStats = useCallback((value: SampleStatistics) => statistics.publish(value), [statistics])
  const onFPS = useCallback((value: number) => setFPS(value), [])
  const showGuide = () => guide.current?.showModal()
  useEffect(() => {
    const handler = () => setFullScreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./" aria-label="Rotor Lab home"><span className="brand-mark"><Atom size={27} strokeWidth={1.4} /></span><span>rotor<span className="brand-light">lab</span><sup> /</sup></span></a><div className="header-divider" /><span className="header-subtitle">A LITTLE ROTATION. A LOT TO DISCOVER.</span><div className="header-actions"><span className="local-badge"><i /> BROWSER-BASED LAB</span><button onClick={showGuide}><BookOpen size={15} /><span>Field notes</span><ChevronRight size={13} /></button></div></header>
    <main>
      <h1 className="sr-only">Rigid rotor simulator</h1>
      <div className="workspace unified-workspace">
        <Controls settings={settings} update={update} setState={setState} />
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
          <div className="explanation-strip"><span className="explanation-icon"><Orbit size={18} /></span><p>{viewSettings.superposition ? <><strong>Components and interference.</strong> Two classical dumbbells compare the component states. The ensemble samples the normalized coherent sum, including interference. {evolving ? 'Both quantum views evolve on the same clock.' : 'Both quantum views show the same t = 0 snapshot.'}</> : <><strong>Same energy, different descriptions.</strong> The classical molecule traces a circle. The ensemble shows independent samples from a stationary quantum orientation distribution; its resampling is not molecular motion. Explore the wavefunction and its probability density in the surface view.</>}</p></div>
          <PhysicsPanel settings={viewSettings} />
        </div>
      </div>
    </main>
    <footer className="site-footer"><span><Atom size={13} /> ROTOR LAB <i /> Built for curiosity.</span><span>J = 0–50 <i /> Condon–Shortley convention <i /> <Check size={11} /> Scientifically grounded</span></footer>
    <dialog ref={guide} className="guide-dialog" onClick={e => { if (e.target === e.currentTarget) guide.current?.close() }}>
      <button className="dialog-close icon-button" autoFocus onClick={() => guide.current?.close()} aria-label="Close field notes"><X size={18} /></button>
      <div className="eyebrow">ROTOR LAB / FIELD NOTES</div><h2>From rotation to probability.</h2>
      <p>All three views share one quantum state and one molecular model. The large central ensemble samples possible orientations, flanked by the classical rotor and the quantum wavefunction.</p>
      <div className="guide-grid"><section><h3>01 / The quantum picture</h3><p>Rotational eigenstates are normalized complex spherical harmonics. J determines energy and total angular momentum; m<sub>J</sub> determines its projection onto z.</p><MathText block>{String.raw`Y_J^m = (-1)^{\max(0,-m)} N_{J|m|} P_J^{|m|}(\cos\theta)e^{im\phi}`}</MathText><p>P includes the Condon–Shortley phase. Individual eigenstates have azimuthally symmetric probability even when their real or imaginary components have azimuthal nodes.</p></section><section><h3>02 / The classical picture</h3><p>A single dumbbell follows a deterministic circle perpendicular to its angular momentum. Its kinetic energy equals the selected quantum energy.</p><MathText block>{String.raw`\omega=\frac{\hbar}{I}\sqrt{J(J+1)},\quad T=\frac{2\pi}{\omega}`}</MathText><p>At J = 0, rotation stops, T is infinite, and L has no direction. Molecular time is scaled to picoseconds per display second so motion can be inspected.</p></section></div>
      <h3>03 / Two orientation distributions</h3><p>For a single eigenstate, sample u = cos θ from p(u) = 2π N²[P(u)]² and sample φ uniformly on [0, 2π). This incorporates the solid-angle element dΩ = sin θ dθ dφ. The polar and azimuthal charts compare theoretical density with sampled histograms. Superposition mode samples the full joint |ψ|², so azimuth need not be uniform.</p>
      <h3>04 / Approaching the classical limit</h3><p>Enable high-J exploration to start at J = 50, m<sub>J</sub> = 50, with the same display clock as the compact range. Follow m<sub>J</sub> = J while changing J up to 50: the exact spread satisfies ⟨cos² θ⟩ = 1/(2J + 3), so orientations concentrate around the equator, while the matched classical angular momentum approaches z. The ensemble approaches the classical orbit's distribution of orientations; it does not acquire a single trajectory. Other choices of m<sub>J</sub> have different limits. High-J polar theory is averaged over the histogram bins to resolve rapid oscillations fairly.</p>
      <h3>05 / Why high-J, m<sub>J</sub> = 0 still has off-axis rotors</h3><p>A high peak in |Y|² at a pole is density per unit solid angle. The probability of a polar cap also includes sin θ dθ dφ. For J = 163, m<sub>J</sub> = 0, independent integration gives 10.94% within 10° of either z pole and 33.33% within 30°. At large J the oscillation-averaged probability per polar angle approaches a uniform distribution on [0, π], so the population remains spread across polar angles.</p>
      <h3>Try these experiments</h3><ol><li>Set <b>J = 0, m<sub>J</sub> = 0</b>: the ensemble is isotropic and the classical rotor is stationary.</li><li>Set <b>J = 1, m<sub>J</sub> = 0</b>: orientations favor the poles. Compare 100 rotors with 5,000 using the logarithmic count slider or exact input.</li><li>Try <b>m<sub>J</sub> = ±1</b>: the polar density favors the equator while the azimuthal density remains uniform.</li><li>Increase J and watch the classical rotor speed up while the quantum probability density remains stationary.</li></ol>
      <p className="guide-callout">Matching L = ℏ√(J(J+1)) and Lz = mℏ constructs a classical comparison vector. A quantum eigenstate does not possess this vector’s classical trajectory.</p>
      <h3>06 / Coherent superpositions</h3><p>Click Enable in the Superposition mode header below Quantum state to add a second independently controlled (J, m<sub>J</sub>) pair. Distinct states have equal amplitudes: ψ = (Y₁ + Y₂)/√2. Interference can break azimuthal symmetry. Identical choices normalize back to one eigenstate. Try the two-lobe and four-lobe examples, or click Randomize both states to choose new J and m<sub>J</sub> values for each component within the active J range.</p><p>The quantum views initially show the zero-relative-phase snapshot at t = 0. Turn on Evolve in time to apply the factors exp(−iE₁t/ℏ) and exp(−iE₂t/ℏ). Both views share the physical time shown above the surface and the Evolution playback speed control (0.01×–5×, default 1×). Pause sampling freezes quantum evolution; turning evolution off restores t = 0. Changing a component state starts a new evolution. Equal-J components have stationary probability, though their complex phase evolves. Different-J components have a changing relative phase and interference pattern. The two colored classical rotors compare the component energies; they are not trajectories of the quantum superposition. The classical polar angles remain fixed by the component quantum numbers.</p>
      <p className="guide-small">Defaults: 2,000 rotors, 5% opacity, 30 sampling updates per second, and 1× playback. The count (1–5,000) and opacity (0.5–75%) sliders are logarithmic. Double-click any slider to reset it to its default. Each visualization has its controls directly below it. Cumulative statistics for both angles accumulate independently of the visible count; state changes start a fresh sequence. Frame drops reduce the effective sampling rate. Surface radii are normalized and molecular dimensions are magnified.</p>
      <button className="primary-button" onClick={() => guide.current?.close()}>Back to the experiment <ChevronRight size={15} /></button>
    </dialog>
  </div>
}
