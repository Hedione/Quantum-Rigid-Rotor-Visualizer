import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { angularMomentumAxis, ClassicalClock, DISPLAY_TIME_SCALE, rotationBasis, type Vec3 } from '../physics/classical'
import { molecularParameters, quantumQuantities } from '../physics/quantum'
import { MAX_ROTORS, OrientationEnsemble, type SampleStatistics } from '../physics/sampling'
import { updateEnsembleMeshes } from '../physics/instancing'
import { createWavefunctionSurface } from '../rendering/wavefunction'
import type { PreparedQuantumState } from '../preparation/types'
import type { SceneKind, Settings } from '../types'
import type { QuantumTimeline } from '../physics/evolution'
import { MAX_HISTOGRAM_BINS } from '../physics/histograms'

const INITIAL_CAMERA: Vec3 = [4.4, -6.3, 3.7]
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const SYNC = new EventTarget()
interface CameraDetail { source: string; position: number[]; target: number[] }

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

function CameraController({ settings, id }: { settings: Settings; id: string }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const busy = useRef(false)
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  // Preserve a common orbit while fitting the smaller flank viewports.
  const fit = Math.max(1, size.height / Math.max(1, size.width) * 0.95)
  useEffect(() => {
    busy.current = true
    camera.position.set(...INITIAL_CAMERA).multiplyScalar(fit)
    camera.up.set(0, 0, 1)
    controls.current?.target.set(0, 0, 0)
    controls.current?.update()
    busy.current = false
  }, [camera, settings.cameraReset, fit])
  useEffect(() => {
    if (!settings.syncCameras) return
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<CameraDetail>).detail
      if (detail.source === id) return
      busy.current = true
      camera.position.fromArray(detail.position.map((value, i) => detail.target[i] + (value - detail.target[i]) * fit))
      controls.current?.target.fromArray(detail.target)
      controls.current?.update()
      busy.current = false
    }
    SYNC.addEventListener('camera', sync)
    return () => SYNC.removeEventListener('camera', sync)
  }, [camera, id, settings.syncCameras, fit])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={3.2 * fit} maxDistance={16 * fit}
    onChange={() => {
      if (!busy.current && settings.syncCameras && controls.current) {
        const target = controls.current.target.toArray()
        const position = camera.position.toArray().map((value, i) => target[i] + (value - target[i]) / fit)
        SYNC.dispatchEvent(new CustomEvent('camera', { detail: { source: id, position, target } }))
      }
    }} />
}

function Laboratory({ settings }: { settings: Settings }) {
  return <>
    <ambientLight intensity={0.65} />
    <directionalLight position={[3, -4, 6]} intensity={2.4} color="#d4fff8" />
    <directionalLight position={[-5, 1, 3]} intensity={1.6} color="#829aff" />
    <pointLight position={[0, 4, -2]} intensity={12} color="#38bfa7" />
    <gridHelper args={[20, 40, '#263647', '#1a2839']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.75]} material-transparent material-opacity={0.33} />
    {settings.zAxis && <group name="laboratory-z-axis">
      <Line points={[[0, 0, -2.55], [0, 0, 2.65]]} color="#91bbc4" lineWidth={0.8} transparent opacity={0.45} dashed dashSize={0.055} gapSize={0.055} />
      <AxisLabel position={[0, 0, 2.85]} hideNearTop>z</AxisLabel>
      <mesh><sphereGeometry args={[0.025, 12, 12]} /><meshBasicMaterial color="#d4fff7" /></mesh>
    </group>}
  </>
}

function Surface({ geometry, overlay = false, timeline, evolving = false }: { geometry: THREE.BufferGeometry; overlay?: boolean; timeline?: QuantumTimeline; evolving?: boolean }) {
  const invalidate = useThree(s => s.invalidate)
  // Keep materials/programs warm when only the prepared geometry changes.
  const animated = geometry.hasAttribute('wavePolar')
  const surface = useMemo(() => createWavefunctionSurface(geometry, 1, overlay), [overlay, animated])
  useLayoutEffect(() => {
    surface.setGeometry(geometry)
    const frame = timeline?.frame
    surface.evolution?.setPhases(frame?.firstPhase ?? 0, frame?.secondPhase ?? 0, evolving)
    invalidate()
  }, [surface, geometry, invalidate, timeline, evolving])
  useFrame(() => {
    if (!surface.evolution || !timeline) return
    const frame = timeline.frame
    surface.evolution.setPhases(frame.firstPhase, frame.secondPhase, evolving && frame.enabled)
  })
  useEffect(() => () => surface.dispose(), [surface])
  return <primitive object={surface.group} />
}

function Nodes({ geometry }: { geometry: THREE.BufferGeometry }) {
  return <lineSegments geometry={geometry}><lineBasicMaterial color="#e8c77d" transparent opacity={0.35} depthWrite={false} /></lineSegments>
}

function QuantumEnsemble({ settings, onStats, timeline }: { settings: Settings; onStats: (s: SampleStatistics) => void; timeline: QuantumTimeline }) {
  const rods = useRef<THREE.InstancedMesh>(null)
  const atomsA = useRef<THREE.InstancedMesh>(null)
  const atomsB = useRef<THREE.InstancedMesh>(null)
  const engine = useMemo(() => new OrientationEnsemble(settings.j, settings.m, settings.seed, settings.count, settings.superposition ? { j: settings.j2, m: settings.m2 } : undefined), [settings.j, settings.m, settings.seed, settings.superposition, settings.superposition ? settings.j2 : 0, settings.superposition ? settings.m2 : 0])
  const scratch = useMemo(() => ({ object: new THREE.Object3D(), vector: new THREE.Vector3() }), [])
  const timing = useRef({ sample: 0, stats: 0 })
  const dirty = useRef(true)
  const previousSignals = useRef({ regenerate: settings.regenerate, resetStats: settings.resetStats })
  const latest = useRef(settings)
  latest.current = settings
  const evolving = settings.superposition && settings.timeEvolution
  const previouslyEvolving = useRef(false)
  useEffect(() => { timing.current.stats = 0 }, [settings.histogramFrequency])

  const writeMatrices = () => {
    if (!rods.current || !atomsA.current || !atomsB.current) return
    updateEnsembleMeshes(engine, { rods: rods.current, atomsA: atomsA.current, atomsB: atomsB.current }, 1.65 * latest.current.bondLength / 1.1, scratch.object, scratch.vector)
    dirty.current = false
  }

  useEffect(() => {
    engine.setCount(settings.count)
    dirty.current = true
    onStats(engine.statistics(MAX_HISTOGRAM_BINS))
  }, [engine, settings.count, onStats])
  useEffect(() => { dirty.current = true }, [settings.bondLength, engine])
  useEffect(() => {
    if (evolving || previouslyEvolving.current) {
      engine.resetStatistics(); engine.regenerate(timeline.frame.relativePhase)
      dirty.current = true; onStats(engine.statistics(MAX_HISTOGRAM_BINS))
    }
    previouslyEvolving.current = evolving
  }, [engine, evolving, timeline, onStats])
  useEffect(() => {
    if (settings.regenerate !== previousSignals.current.regenerate) {
      previousSignals.current.regenerate = settings.regenerate
      engine.regenerate(timeline.frame.relativePhase); dirty.current = true; onStats(engine.statistics(MAX_HISTOGRAM_BINS))
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
      engine.regenerate(timeline.frame.relativePhase, false)
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
    <instancedMesh ref={rods} {...instanceProps}>
      <cylinderGeometry args={[0.014, 0.014, 1, 6]} /><meshBasicMaterial color="#286d5d" toneMapped={false} transparent opacity={settings.rotorOpacity * 0.72} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
    <instancedMesh ref={atomsA} {...instanceProps}>
      <sphereGeometry args={[0.065, 8, 6]} /><meshBasicMaterial color="#00f58a" toneMapped={false} transparent opacity={settings.rotorOpacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
    <instancedMesh ref={atomsB} {...instanceProps}>
      <sphereGeometry args={[0.065, 8, 6]} /><meshBasicMaterial color="#aa28ff" toneMapped={false} transparent opacity={settings.rotorOpacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  </group>
}

function ClassicalRotor({ settings, second = false }: { settings: Settings; second?: boolean }) {
  const rotor = useRef<THREE.Group>(null)
  const j = second ? settings.j2 : settings.j, m = second ? settings.m2 : settings.m
  const color = second ? '#91b7ff' : '#f2ae85'
  const { inertia } = molecularParameters(settings.atomMass, settings.bondLength)
  const { omega } = quantumQuantities(j, m, inertia)
  const axis = useMemo(() => angularMomentumAxis(j, m), [j, m])
  const basis = useMemo(() => rotationBasis(axis ?? [0, 0, 1]), [axis])
  const clock = useRef(new ClassicalClock(second ? Math.PI / 2 : 0))
  const vector = useMemo(() => new THREE.Vector3(), [])
  const e2 = useMemo(() => new THREE.Vector3(...basis.e2), [basis])
  const half = 1.65 * settings.bondLength / 1.1
  useFrame((_, delta) => {
    const angle = clock.current.advance(delta, omega, DISPLAY_TIME_SCALE, settings.playback, false)
    vector.set(...basis.e1).multiplyScalar(Math.cos(angle)).addScaledVector(e2, Math.sin(angle))
    rotor.current?.quaternion.setFromUnitVectors(Y_AXIS, vector)
  })
  const circle = useMemo(() => Array.from({ length: 129 }, (_, i) => {
    const a = i * Math.PI / 64
    return basis.e1.map((x, k) => half * (Math.cos(a) * x + Math.sin(a) * basis.e2[k])) as Vec3
  }), [basis, half])
  const arrow = useMemo(() => axis ? new THREE.ArrowHelper(new THREE.Vector3(...axis), new THREE.Vector3(), 2.5, color, 0.22, 0.1) : null, [axis, color])
  return <>
    <group ref={rotor} name={second ? 'classical-component-2' : 'classical-component-1'}>
      <mesh><cylinderGeometry args={[0.047, 0.047, half * 2, 16]} /><meshStandardMaterial color="#b8c6d5" metalness={0.6} roughness={0.25} /></mesh>
      <mesh position={[0, half, 0]}><sphereGeometry args={[0.19, 32, 24]} /><meshPhysicalMaterial color={color} roughness={0.25} metalness={0.15} clearcoat={1} /></mesh>
      <mesh position={[0, -half, 0]}><sphereGeometry args={[0.19, 32, 24]} /><meshPhysicalMaterial color={color} roughness={0.25} metalness={0.15} clearcoat={1} /></mesh>
    </group>
    {axis && <Line points={circle} color={color} transparent opacity={0.45} dashed dashSize={0.055} gapSize={0.055} lineWidth={1} />}
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
  const evolving = settings.superposition && settings.timeEvolution
  const zeroComponent = !evolving && mode === 'wavefunction' && (settings.surfaceQuantity === 'real' || settings.surfaceQuantity === 'imaginary') && prepared?.surface.boundingSphere?.radius === 0
  return <div className="canvas-container" data-testid={`scene-${mode}`} data-rotor-count={mode === 'ensemble' ? settings.count : mode === 'classical' ? settings.superposition ? 2 : 1 : undefined}>
    <SceneBoundary>{mounted && <Canvas frameloop={mode === 'wavefunction' && !evolving ? 'demand' : 'always'} dpr={[1, 1.5]} camera={{ position: INITIAL_CAMERA, fov: 40, near: 0.1, far: 80, up: [0, 0, 1] }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Laboratory settings={settings} />
      <CameraController settings={settings} id={id} />
      {mode === 'wavefunction' && prepared && <><Surface geometry={prepared.surface} timeline={timeline} evolving={evolving} />{prepared.nodes && <Nodes geometry={prepared.nodes} />}</>}
      {mode === 'ensemble' && prepared && <>{prepared.overlay && <Surface geometry={prepared.overlay} overlay />}<QuantumEnsemble settings={settings} onStats={onStats} timeline={timeline} /></>}
      {mode === 'classical' && <><ClassicalRotor settings={settings} />{settings.superposition && <ClassicalRotor settings={settings} second />}</>}
      {onFPS && <FrameRate onFPS={onFPS} />}
    </Canvas>}</SceneBoundary>
    {zeroComponent && <div className="zero-component">{settings.superposition ? `${settings.surfaceQuantity === 'real' ? 'Re' : 'Im'}(ψ) = 0` : <>Im(Y) = 0 for m<sub>J</sub> = 0</>}<span>{settings.superposition ? 'This component vanishes for the selected coherent sum.' : 'This eigenfunction is purely real.'}</span></div>}
  </div>
}
