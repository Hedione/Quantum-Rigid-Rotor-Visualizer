import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { angularMomentumAxis, ClassicalClock, DISPLAY_TIME_SCALE, rotationBasis, type Vec3 } from '../physics/classical'
import { quantumQuantities } from '../physics/quantum'
import { getMolecularParameters } from '../physics/molecule'
import { MAX_ROTORS, OrientationEnsemble, type SampleStatistics } from '../physics/sampling'
import { ENSEMBLE_ATOM_RADIUS, ENSEMBLE_ATOM_RADIUS_PM, ROTOR_DISPLAY_UNITS_PER_ANGSTROM, updateEnsembleMeshes } from '../physics/instancing'
import { createWavefunctionSurface } from '../rendering/wavefunction'
import { createParticleDepthPass, getRotorPalette } from '../rendering/rotors'
import type { PreparedQuantumState } from '../preparation/types'
import { defaultSettings, surfaceColorMode, type SceneKind, type Settings } from '../types'
import type { QuantumTimeline } from '../physics/evolution'
import { MAX_HISTOGRAM_BINS } from '../physics/histograms'
import { dipoleExpectation, electricField, electromagneticWave, transitionDipole, transitionRates, validateTransition } from '../physics/transition'
import { initialCoefficients } from '../physics/superposition'
import { applyCameraView, CAMERA_FOV, INITIAL_CAMERA, orthographicViewZoom, readCameraView, type CameraView } from '../rendering/camera'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const SYNC = new EventTarget()
interface CameraDetail extends CameraView { source: string }

/** Canvas sprites keep labels in the same renderer lifecycle as their scene. */
function AxisLabel({ position, children, momentum = false, color, hideNearTop = false }: { position: Vec3; children: string; momentum?: boolean; color?: string; hideNearTop?: boolean }) {
  const sprite = useRef<THREE.Sprite>(null)
  const viewDirection = useMemo(() => new THREE.Vector3(), [])
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    context.font = momentum ? 'italic 76px Georgia' : '500 70px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = color ?? (momentum ? '#f0be8b' : '#8da6b6')
    context.fillText(children, 64, 64)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  }, [children, momentum, color])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame(({ camera }) => {
    if (!hideNearTop || !sprite.current) return
    // Fade between 6° and 3° from +z, before the nearby sprite dominates the view.
    const topAlignment = -camera.getWorldDirection(viewDirection).z
    const opacity = 1 - THREE.MathUtils.smoothstep(topAlignment, Math.cos(6 * THREE.MathUtils.DEG2RAD), Math.cos(3 * THREE.MathUtils.DEG2RAD))
    sprite.current.material.opacity = opacity
    sprite.current.visible = opacity > 0
  })
  return <sprite ref={sprite} position={position} scale={[0.25, 0.25, 1]} renderOrder={10}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} /></sprite>
}

function CameraController({ settings, id, fitScale }: { settings: Settings; id: string; fitScale: number }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const busy = useRef(false)
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  // Preserve a common orbit while fitting the smaller flank viewports.
  const fit = Math.max(1, size.height / Math.max(1, size.width) * 0.95) * Math.max(1, fitScale)
  const baseZoom = orthographicViewZoom(size.height, fit)
  const saved = useRef<CameraView>({ position: [...INITIAL_CAMERA], target: [0, 0, 0] })
  const previousReset = useRef(-1)
  const appliedCamera = useRef<typeof camera | null>(null)
  const applyView = useCallback((view: CameraView) => {
    busy.current = true
    camera.up.set(0, 0, 1)
    camera.far = 80 * Math.max(1, fitScale)
    applyCameraView(camera, view, fit, baseZoom, size)
    controls.current?.target.fromArray(view.target)
    controls.current?.update()
    appliedCamera.current = camera
    busy.current = false
  }, [camera, fit, baseZoom, fitScale, size.width, size.height])
  useEffect(() => {
    if (previousReset.current !== settings.cameraReset) {
      saved.current = { position: [...INITIAL_CAMERA], target: [0, 0, 0] }
      previousReset.current = settings.cameraReset
    }
    applyView(saved.current)
  }, [applyView, settings.cameraReset])
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<CameraDetail>).detail
      if (detail.source === id) return
      saved.current = detail
      applyView(detail)
    }
    SYNC.addEventListener('camera', sync)
    return () => SYNC.removeEventListener('camera', sync)
  }, [applyView, id])
  const referenceDistance = Math.hypot(...INITIAL_CAMERA)
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={3.2 * fit} maxDistance={16 * fit} minZoom={baseZoom * referenceDistance / 16} maxZoom={baseZoom * referenceDistance / 3.2}
    onChange={() => {
      if (!busy.current && appliedCamera.current === camera && controls.current) {
        const view = readCameraView(camera, controls.current.target, fit, baseZoom)
        saved.current = view
        SYNC.dispatchEvent(new CustomEvent('camera', { detail: { source: id, ...view } }))
      }
    }} />
}

function Laboratory({ bondScale }: { bondScale: number }) {
  return <>
    <ambientLight intensity={0.65} />
    <directionalLight position={[3, -4, 6]} intensity={2.4} color="#d4fff8" />
    <directionalLight position={[-5, 1, 3]} intensity={1.6} color="#829aff" />
    <pointLight position={[0, 4, -2]} intensity={12} color="#38bfa7" />
    <gridHelper name="laboratory-floor" args={[20, 40, '#263647', '#1a2839']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -2.3 * Math.max(1, bondScale)]} material-transparent material-opacity={0.33} />
    <group name="laboratory-z-axis">
      <Line points={[[0, 0, -2.55], [0, 0, 2.65]]} color="#91bbc4" lineWidth={0.8} transparent opacity={0.45} dashed dashSize={0.055} gapSize={0.055} />
      <AxisLabel position={[0, 0, 2.85]} hideNearTop>z</AxisLabel>
      <mesh><sphereGeometry args={[0.025, 12, 12]} /><meshBasicMaterial color="#d4fff7" /></mesh>
    </group>
  </>
}

function Surface({ geometry, overlay = false, timeline, evolving = false, coherent = false }: { geometry: THREE.BufferGeometry; overlay?: boolean; timeline?: QuantumTimeline; evolving?: boolean; coherent?: boolean }) {
  const invalidate = useThree(s => s.invalidate)
  // Keep materials/programs warm when only the prepared geometry changes.
  const animated = geometry.hasAttribute('wavePolar')
  const surface = useMemo(() => createWavefunctionSurface(geometry, 1, overlay), [overlay, animated])
  useLayoutEffect(() => {
    surface.setGeometry(geometry)
    const frame = timeline?.frame
    if (coherent && frame?.coefficients) surface.evolution?.setCoefficients(frame.coefficients, true)
    else surface.evolution?.setPhases(frame?.firstPhase ?? 0, frame?.secondPhase ?? 0, evolving)
    invalidate()
  }, [surface, geometry, invalidate, timeline, evolving, coherent])
  useFrame(() => {
    if (!surface.evolution || !timeline) return
    const frame = timeline.frame
    if (coherent && frame.coefficients) surface.evolution.setCoefficients(frame.coefficients, true)
    else surface.evolution.setPhases(frame.firstPhase, frame.secondPhase, evolving && frame.enabled)
  })
  useEffect(() => () => surface.dispose(), [surface])
  return <primitive object={surface.group} />
}

function QuantumEnsemble({ settings, onStats, timeline }: { settings: Settings; onStats: (s: SampleStatistics) => void; timeline: QuantumTimeline }) {
  const rods = useRef<THREE.InstancedMesh>(null)
  const atomsA = useRef<THREE.InstancedMesh>(null)
  const atomsB = useRef<THREE.InstancedMesh>(null)
  const depthGroup = useMemo(() => new THREE.Group(), [])
  const depthPass = useRef<ReturnType<typeof createParticleDepthPass> | null>(null)
  const { firstFraction, mass1, mass2 } = getMolecularParameters(settings)
  const palette = getRotorPalette(settings)
  const opacity = settings.rotorOpacity
  const blending = settings.particleOcclusion ? THREE.NormalBlending : THREE.AdditiveBlending
  const engine = useMemo(() => new OrientationEnsemble(settings.j, settings.m, settings.seed, settings.count, settings.superposition ? { j: settings.j2, m: settings.m2 } : undefined), [settings.j, settings.m, settings.seed, settings.superposition, settings.superposition ? settings.j2 : 0, settings.superposition ? settings.m2 : 0])
  const scratch = useMemo(() => ({ object: new THREE.Object3D(), vector: new THREE.Vector3() }), [])
  const timing = useRef({ sample: 0, stats: 0 })
  const dirty = useRef(true)
  const previousSignals = useRef({ regenerate: settings.regenerate, resetStats: settings.resetStats })
  const latest = useRef(settings)
  latest.current = settings
  const evolving = settings.coherentTransition || (settings.superposition && settings.timeEvolution)
  const previouslyEvolving = useRef(false)
  useEffect(() => { timing.current.stats = 0 }, [settings.histogramFrequency])

  const writeMatrices = () => {
    if (!rods.current || !atomsA.current || !atomsB.current) return
    const current = latest.current
    updateEnsembleMeshes(engine, { rods: rods.current, atomsA: atomsA.current, atomsB: atomsB.current }, ROTOR_DISPLAY_UNITS_PER_ANGSTROM * current.bondLength / 2, scratch.object, scratch.vector, getMolecularParameters(current).firstFraction, current.ensembleAtomRadius / ENSEMBLE_ATOM_RADIUS_PM)
    depthPass.current?.sync()
    dirty.current = false
  }

  useLayoutEffect(() => {
    if (!settings.particleOcclusion || !rods.current || !atomsA.current || !atomsB.current) return
    const pass = createParticleDepthPass({ rods: rods.current, atomsA: atomsA.current, atomsB: atomsB.current })
    depthPass.current = pass
    depthGroup.add(pass.group)
    return () => { depthGroup.remove(pass.group); pass.dispose(); depthPass.current = null }
  }, [settings.particleOcclusion, depthGroup])

  useEffect(() => {
    engine.setCount(settings.count)
    dirty.current = true
    onStats(engine.statistics(MAX_HISTOGRAM_BINS))
  }, [engine, settings.count, onStats])
  useEffect(() => { dirty.current = true }, [settings.bondLength, firstFraction, settings.ensembleAtomRadius, engine])
  useEffect(() => {
    if (evolving || previouslyEvolving.current) {
      engine.resetStatistics(); engine.regenerate(timeline.frame.relativePhase, true, settings.coherentTransition ? timeline.frame.coefficients : undefined)
      dirty.current = true; onStats(engine.statistics(MAX_HISTOGRAM_BINS))
    }
    previouslyEvolving.current = evolving
  }, [engine, evolving, timeline, onStats, mass1, mass2, settings.bondLength, settings.coherentTransition, settings.transitionRun, settings.drivePhase, settings.rabiFrequency, settings.polarization])
  useEffect(() => {
    if (settings.regenerate !== previousSignals.current.regenerate) {
      previousSignals.current.regenerate = settings.regenerate
      engine.regenerate(timeline.frame.relativePhase, true, settings.coherentTransition ? timeline.frame.coefficients : undefined); dirty.current = true; onStats(engine.statistics(MAX_HISTOGRAM_BINS))
    }
  }, [engine, settings.regenerate, onStats])
  useEffect(() => {
    if (settings.resetStats !== previousSignals.current.resetStats) {
      previousSignals.current.resetStats = settings.resetStats
      engine.resetStatistics(); onStats(engine.statistics(MAX_HISTOGRAM_BINS))
    }
  }, [engine, settings.resetStats, onStats])

  useFrame((_, delta) => {
    const time = timing.current
    time.sample += delta
    time.stats += delta
    if (!settings.ensemblePaused && time.sample >= 1 / settings.frequency) {
      // Drop missed wall-clock batches after backgrounding; never stall the UI to catch up.
      time.sample %= 1 / settings.frequency
      engine.regenerate(timeline.frame.relativePhase, false, settings.coherentTransition ? timeline.frame.coefficients : undefined)
      dirty.current = true
    }
    if (dirty.current) writeMatrices()
    if (time.stats >= 1 / settings.histogramFrequency) {
      time.stats %= 1 / settings.histogramFrequency
      if (!settings.ensemblePaused && engine.collectBatch()) onStats(engine.statistics(MAX_HISTOGRAM_BINS))
    }
  })
  const instanceProps = { args: [undefined, undefined, MAX_ROTORS] as [undefined, undefined, number], frustumCulled: false }
  return <group>
    <primitive object={depthGroup} />
    <instancedMesh ref={rods} {...instanceProps}>
      <cylinderGeometry args={[0.014, 0.014, 1, 6]} /><meshBasicMaterial color={palette.bond} toneMapped={false} transparent={!settings.particleOcclusion || opacity < 1} opacity={settings.particleOcclusion ? opacity : opacity * 0.72} depthWrite={false} depthTest={settings.particleOcclusion} blending={blending} />
    </instancedMesh>
    <instancedMesh ref={atomsA} {...instanceProps}>
      <sphereGeometry args={[ENSEMBLE_ATOM_RADIUS, 8, 6]} /><meshBasicMaterial color={palette.first} toneMapped={false} transparent={!settings.particleOcclusion || opacity < 1} opacity={opacity} depthWrite={false} depthTest={settings.particleOcclusion} blending={blending} />
    </instancedMesh>
    <instancedMesh ref={atomsB} {...instanceProps}>
      <sphereGeometry args={[ENSEMBLE_ATOM_RADIUS, 8, 6]} /><meshBasicMaterial color={palette.second} toneMapped={false} transparent={!settings.particleOcclusion || opacity < 1} opacity={opacity} depthWrite={false} depthTest={settings.particleOcclusion} blending={blending} />
    </instancedMesh>
  </group>
}

function DrivenField({ settings, timeline }: { settings: Settings; timeline: QuantumTimeline }) {
  const electricLabel = useRef<THREE.Group>(null), dipoleLabel = useRef<THREE.Group>(null)
  const arrows = useMemo(() => [new THREE.ArrowHelper(Y_AXIS, new THREE.Vector3(), 1, '#35d3e4'), new THREE.ArrowHelper(Y_AXIS, new THREE.Vector3(), 1, '#ffb547')], [])
  const vector = useMemo(() => new THREE.Vector3(), [])
  const wave = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'electromagnetic-wave'
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(161 * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#35d3e4', transparent: true, opacity: 0.75, toneMapped: false }))
    line.name = 'electric-wave'
    line.frustumCulled = false
    group.add(line)
    const propagation = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 5.2, '#78cda0', 0.2, 0.1)
    group.add(propagation)
    return { group, line, propagation }
  }, [])
  const angularDipole = useMemo(() => transitionDipole(settings), [settings.j, settings.m, settings.j2, settings.m2, settings.polarization])
  const allowed = validateTransition(settings).allowed, rates = transitionRates(settings), resonance = rates.resonance
  const linear = settings.polarization === 'pi'
  useEffect(() => () => arrows.forEach(arrow => arrow.dispose()), [arrows])
  useEffect(() => () => {
    wave.line.geometry.dispose(); wave.line.material.dispose()
    wave.propagation.dispose()
  }, [wave])
  useFrame(() => {
    const frame = timeline.frame
    wave.group.visible = allowed
    if (allowed) {
      const wavelength = rates.photonWavelength
      for (let i = 0; i < 161; i++) {
        const distance = (i / 160 * 2 - 1) * 2.5
        // One wavelength spans three display units; physical phase still follows the shared clock.
        const field = electromagneticWave(settings, resonance, frame.time, settings.drivePhase, distance * wavelength / 3, angularDipole).electric
        wave.line.geometry.getAttribute('position').setXYZ(i, (linear ? distance : 0) + field.x * 2.2, field.y * 2.2, (linear ? 0 : distance) + field.z * 2.2)
      }
      wave.line.geometry.getAttribute('position').needsUpdate = true
      vector.set(linear ? 1 : 0, 0, linear ? 0 : 1)
      wave.propagation.setDirection(vector); wave.propagation.position.copy(vector).multiplyScalar(-2.6)
    }
    const field = allowed ? electricField(settings, resonance, frame.time, settings.drivePhase, angularDipole) : { x: 0, y: 0, z: 0 }
    const dipole = dipoleExpectation(settings, frame.coefficients ?? initialCoefficients, angularDipole)
    const updateArrow = (index: number, value: typeof field, scale: number, label: THREE.Group | null) => {
      vector.set(value.x, value.y, value.z).multiplyScalar(scale)
      const length = vector.length() * 2.2, visible = length > 1e-8
      arrows[index].visible = visible
      if (label) label.visible = visible
      if (!visible) return
      vector.normalize(); arrows[index].setDirection(vector)
      arrows[index].setLength(length, Math.min(0.24, length * 0.3), Math.min(0.13, length * 0.16))
      label?.position.copy(vector).multiplyScalar(length + 0.22)
    }
    updateArrow(0, field, 1, electricLabel.current)
    updateArrow(1, dipole, settings.dipoleMoment > 0 ? 1 / settings.dipoleMoment : 0, dipoleLabel.current)
  })
  return <>
    <Line points={[[-2.55, 0, 0], [2.65, 0, 0]]} color="#91bbc4" lineWidth={0.8} transparent opacity={0.45} />
    <Line points={[[0, -2.55, 0], [0, 2.65, 0]]} color="#91bbc4" lineWidth={0.8} transparent opacity={0.45} />
    <AxisLabel position={[2.85, 0, 0]}>x</AxisLabel><AxisLabel position={[0, 2.85, 0]}>y</AxisLabel>
    {arrows.map((arrow, index) => <primitive key={index} object={arrow} />)}
    <primitive object={wave.group} />
    {allowed && <AxisLabel position={linear ? [3.05, 0, 0.25] : [0.25, 0, 3.05]} color="#78cda0">k</AxisLabel>}
    <group ref={electricLabel}><AxisLabel position={[0, 0, 0]} color="#35d3e4">E</AxisLabel></group>
    <group ref={dipoleLabel}><AxisLabel position={[0, 0, 0]} momentum color="#ffb547">μ</AxisLabel></group>
  </>
}

function ClassicalRotor({ settings, second = false }: { settings: Settings; second?: boolean }) {
  const rotor = useRef<THREE.Group>(null)
  const j = second ? settings.j2 : settings.j, m = second ? settings.m2 : settings.m
  const color = second ? '#91b7ff' : '#f2ae85'
  const { inertia, firstFraction, secondFraction } = getMolecularParameters(settings)
  const { omega } = quantumQuantities(j, m, inertia)
  const axis = useMemo(() => angularMomentumAxis(j, m), [j, m])
  const basis = useMemo(() => rotationBasis(axis ?? [0, 0, 1]), [axis])
  const clock = useRef(new ClassicalClock(second ? Math.PI / 2 : 0))
  const vector = useMemo(() => new THREE.Vector3(), [])
  const e2 = useMemo(() => new THREE.Vector3(...basis.e2), [basis])
  const half = ROTOR_DISPLAY_UNITS_PER_ANGSTROM * settings.bondLength / 2
  const firstDistance = 2 * half * firstFraction, secondDistance = 2 * half * secondFraction
  useFrame((_, delta) => {
    const angle = clock.current.advance(delta, omega, DISPLAY_TIME_SCALE, settings.playback, false)
    vector.set(...basis.e1).multiplyScalar(Math.cos(angle)).addScaledVector(e2, Math.sin(angle))
    rotor.current?.quaternion.setFromUnitVectors(Y_AXIS, vector)
  })
  const circles = useMemo(() => [firstDistance, -secondDistance].map(radius => Array.from({ length: 129 }, (_, i) => {
    const a = i * Math.PI / 64
    return basis.e1.map((x, k) => radius * (Math.cos(a) * x + Math.sin(a) * basis.e2[k])) as Vec3
  })), [basis, firstDistance, secondDistance])
  const arrow = useMemo(() => axis ? new THREE.ArrowHelper(new THREE.Vector3(...axis), new THREE.Vector3(), 2.5, color, 0.22, 0.1) : null, [axis, color])
  return <>
    <group ref={rotor} name={second ? 'classical-component-2' : 'classical-component-1'}>
      <mesh position={[0, (firstDistance - secondDistance) / 2, 0]}><cylinderGeometry args={[0.047, 0.047, half * 2, 16]} /><meshStandardMaterial color="#b8c6d5" metalness={0.6} roughness={0.25} /></mesh>
      <mesh position={[0, firstDistance, 0]}><sphereGeometry args={[0.19, 32, 24]} /><meshPhysicalMaterial color={color} roughness={0.25} metalness={0.15} clearcoat={1} /></mesh>
      <mesh position={[0, -secondDistance, 0]}><sphereGeometry args={[0.19, 32, 24]} /><meshPhysicalMaterial color={color} roughness={0.25} metalness={0.15} clearcoat={1} /></mesh>
    </group>
    {axis && circles.slice(0, Math.abs(firstDistance - secondDistance) > 1e-8 ? 2 : 1).map((circle, i) => <Line key={i} points={circle} color={color} transparent opacity={0.45} dashed dashSize={0.055} gapSize={0.055} lineWidth={1} />)}
    {arrow && <><primitive object={arrow} /><AxisLabel position={axis!.map(x => x * 2.72) as Vec3} momentum color={color}>{settings.superposition ? second ? 'L₂' : 'L₁' : 'L'}</AxisLabel></>}
  </>
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="webgl-fallback"><strong>3D rendering is unavailable</strong><p>Enable WebGL / hardware acceleration, then reload. The physics controls and calculations remain available.</p></div> : this.props.children }
}

function FrameRate({ onFPS }: { onFPS: (fps: number) => void }) {
  const count = useRef(0), elapsed = useRef(0)
  useFrame((_, delta) => { count.current++; elapsed.current += delta; if (elapsed.current >= 1) { onFPS(Math.round(count.current / elapsed.current)); count.current = 0; elapsed.current = 0 } })
  return null
}

export function Scene({ mode, settings, prepared, onStats, id, onFPS, timeline }: { prepared: PreparedQuantumState | null; mode: SceneKind; settings: Settings; onStats: (s: SampleStatistics) => void; id: string; onFPS?: (fps: number) => void; timeline: QuantumTimeline }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const orthographic = mode === 'field'
  const camera = useMemo(() => {
    const next = orthographic ? new THREE.OrthographicCamera() : new THREE.PerspectiveCamera(CAMERA_FOV)
    next.position.fromArray(INITIAL_CAMERA); next.up.set(0, 0, 1); next.near = 0.1; next.far = 80
    return next
  }, [orthographic])
  const evolving = settings.coherentTransition || (settings.timeEvolution && (settings.j > 0 || (settings.superposition && settings.j2 > 0)) && (surfaceColorMode(settings.surfaceQuantity) !== 'density' || (settings.superposition && settings.j !== settings.j2)))
  const bondScale = mode === 'field' ? 1 : settings.bondLength / defaultSettings.bondLength
  const zeroComponent = !evolving && mode === 'wavefunction' && (settings.surfaceQuantity === 'real' || settings.surfaceQuantity === 'imaginary') && prepared?.surface.boundingSphere?.radius === 0
  return <div className="canvas-container" data-testid={`scene-${mode}`} data-bond-length={settings.bondLength} data-display-scale={bondScale} data-rotor-count={mode === 'ensemble' ? settings.count : mode === 'classical' ? settings.superposition ? 2 : 1 : undefined} data-first-mass-fraction={mode !== 'wavefunction' ? getMolecularParameters(settings).firstFraction : undefined} data-particle-occlusion={mode === 'ensemble' ? settings.particleOcclusion : undefined} data-rotor-palette={mode === 'ensemble' ? settings.rotorPalette : undefined}>
    <SceneBoundary>{mounted && <Canvas orthographic={orthographic} frameloop={mode === 'wavefunction' && !evolving ? 'demand' : 'always'} dpr={[1, 1.5]} camera={camera} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Laboratory bondScale={bondScale} />
      <CameraController settings={settings} id={id} fitScale={mode === 'field' ? 1.2 : bondScale} />
      {mode === 'wavefunction' && prepared && <group scale={bondScale}><Surface geometry={prepared.surface} timeline={timeline} evolving={evolving} coherent={settings.coherentTransition} /></group>}
      {mode === 'ensemble' && prepared && <>{prepared.overlay && <group scale={bondScale}><Surface geometry={prepared.overlay} overlay timeline={timeline} evolving={settings.coherentTransition} coherent={settings.coherentTransition} /></group>}<QuantumEnsemble settings={settings} onStats={onStats} timeline={timeline} /></>}
      {mode === 'classical' && <><ClassicalRotor settings={settings} />{settings.superposition && <ClassicalRotor settings={settings} second />}</>}
      {mode === 'field' && <DrivenField settings={settings} timeline={timeline} />}
      {onFPS && <FrameRate onFPS={onFPS} />}
    </Canvas>}</SceneBoundary>
    {zeroComponent && <div className="zero-component">{settings.superposition ? `${settings.surfaceQuantity === 'real' ? 'Re' : 'Im'}(ψ) = 0` : <>Im(Y) = 0 for m<sub>J</sub> = 0</>}<span>{settings.superposition ? 'This component vanishes for the selected coherent sum.' : 'This eigenfunction is purely real.'}</span></div>}
  </div>
}
