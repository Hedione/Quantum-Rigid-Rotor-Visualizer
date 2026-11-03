import * as THREE from 'three'
import { createWavefunctionGeometry } from '../../src/rendering/wavefunction'
import { createSurfaceEvolution, vertexEvolution } from '../../src/rendering/evolving-surface'
import { QuantumTimeline } from '../../src/physics/evolution'
import { transitionTimeScale } from '../../src/physics/transition'
import { defaultSettings, type Polarization, type Settings } from '../../src/types'
import { packGeometry, unpackGeometry } from '../../src/preparation/geometry'

interface Result { mode: string; state: number[]; quantity: string; frames: number; minimum: number; maximum: number; maximumError: number; worstProgress: number }
declare global { interface Window { normalizationGPU: Result[] } }
const renderer = new THREE.WebGLRenderer({ antialias: false })
const camera = new THREE.Camera(), scene = new THREE.Scene(), results: Result[] = []

// Composite Simpson quadrature, with a final 3/8 panel for odd mesh heights.
function thetaWeights(intervals: number) {
  const result = new Float64Array(intervals + 1), h = Math.PI / intervals
  const even = intervals % 2 ? intervals - 3 : intervals
  if (even) for (let i = 0; i <= even; i++) result[i] += h / 3 * (i === 0 || i === even ? 1 : i % 2 ? 4 : 2)
  if (even !== intervals) for (let i = 0; i <= 3; i++) result[even + i] += 3 * h / 8 * (i === 0 || i === 3 ? 1 : 3)
  return result
}

const configurations: { mode: string; state: Partial<Settings>; frames: number }[] = [
  { mode: 'eigenstate', state: { j: 0, m: 0 }, frames: 3 },
  { mode: 'eigenstate', state: { j: 1, m: -1 }, frames: 3 },
  { mode: 'eigenstate', state: { j: 50, m: 0 }, frames: 3 },
  { mode: 'eigenstate', state: { j: 200, m: 0 }, frames: 1 },
  { mode: 'eigenstate', state: { j: 200, m: -200 }, frames: 3 },
  { mode: 'equal superposition', state: { superposition: true, j: 0, m: 0, j2: 1, m2: 0 }, frames: 11 },
  { mode: 'equal superposition', state: { superposition: true, j: 1, m: 1, j2: 1, m2: -1 }, frames: 11 },
  { mode: 'identical superposition', state: { superposition: true, j: 2, m: -1, j2: 2, m2: -1 }, frames: 3 },
  { mode: 'equal superposition', state: { superposition: true, j: 50, m: 50, j2: 50, m2: -50 }, frames: 11 },
  ...([
    [1, 1, 2, 0, 'sigmaMinus'], [0, 0, 1, 0, 'pi'], [0, 0, 1, 1, 'sigmaPlus'],
    [50, 0, 49, -1, 'sigmaMinus'], [50, -50, 49, -49, 'sigmaPlus'],
  ] as [number, number, number, number, Polarization][]).map(([j, m, j2, m2, polarization]) => ({ mode: 'π-pulse', state: { j, m, j2, m2, polarization, superposition: true, coherentTransition: true, transitionPlaying: true, drivePhase: 0.73 }, frames: 101 })),
]

for (const configuration of configurations) for (const quantity of ['probability', 'jointProbability'] as const) {
  const settings = { ...defaultSettings, ...configuration.state, surfaceQuantity: quantity }
  const source = createWavefunctionGeometry(settings), { widthSegments: columns, heightSegments: rows } = source.parameters
  const geometry = unpackGeometry(structuredClone(packGeometry(source)))
  const controllerMaterial = new THREE.MeshBasicMaterial(), evolution = createSurfaceEvolution([controllerMaterial]); evolution.setGeometry(geometry)
  const shader = { uniforms: {}, vertexShader: '' } as unknown as Parameters<THREE.Material['onBeforeCompile']>[0]
  controllerMaterial.onBeforeCompile(shader, renderer)
  const count = geometry.getAttribute('position').count, width = 512, height = Math.ceil(count / width)
  const captureGeometry = geometry.clone(), positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) { positions[i * 3] = 2 * ((i % width + 0.5) / width) - 1; positions[i * 3 + 1] = 2 * ((Math.floor(i / width) + 0.5) / height) - 1 }
  captureGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); captureGeometry.setIndex(null)
  const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: shader.uniforms,
    vertexShader: `precision highp float;\n#define attribute in\n${vertexEvolution}\nin vec3 position; out float physicalDensity; void main() { WaveVertex wave = evolveWave(); float maximum = waveModes.w > 1.5 ? waveMaxima.z : waveMaxima.y; physicalDensity = length(wave.position) * maximum / 1.9; gl_Position = vec4(position, 1.0); gl_PointSize = 1.0; }`,
    fragmentShader: 'precision highp float; in float physicalDensity; out vec4 result; void main() { result = vec4(physicalDensity, 0.0, 0.0, 1.0); }',
  })
  const points = new THREE.Points(captureGeometry, material); points.frustumCulled = false; scene.add(points)
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, depthBuffer: false })
  const weights = thetaWeights(rows), samples = new Float32Array(width * height * 4)
  const timeline = new QuantumTimeline(); timeline.configure(settings, 0)
  const pulseDuration = Math.PI / (settings.rabiFrequency * 1e12)
  const result: Result = { mode: configuration.mode, state: [settings.j, settings.m, settings.j2, settings.m2], quantity, frames: configuration.frames, minimum: Infinity, maximum: -Infinity, maximumError: 0, worstProgress: 0 }
  for (let sample = 0; sample < configuration.frames; sample++) {
    const progress = configuration.frames === 1 ? 0 : sample / (configuration.frames - 1)
    const frame = timeline.read(settings.coherentTransition ? pulseDuration / transitionTimeScale(settings) * 1000 * progress : progress * 17000)
    if (settings.coherentTransition) evolution.setCoefficients(frame.coefficients!, true)
    else evolution.setPhases(frame.firstPhase, frame.secondPhase, true)
    renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, width, height, samples)
    let integral = 0
    for (let row = 0; row <= rows; row++) {
      let azimuthIntegral = 0
      // Exclude the duplicated phi seam. The periodic Fourier integral is exact.
      for (let col = 0; col < columns; col++) azimuthIntegral += samples[(row * (columns + 1) + col) * 4]
      integral += azimuthIntegral * (2 * Math.PI / columns) * weights[row] * (quantity === 'probability' ? Math.sin(row * Math.PI / rows) : 1)
    }
    result.minimum = Math.min(result.minimum, integral); result.maximum = Math.max(result.maximum, integral)
    if (Math.abs(integral - 1) > result.maximumError) { result.maximumError = Math.abs(integral - 1); result.worstProgress = progress }
  }
  results.push(result)
  scene.remove(points); target.dispose(); material.dispose(); controllerMaterial.dispose(); captureGeometry.dispose(); geometry.dispose(); source.dispose()
}
renderer.dispose()
window.normalizationGPU = results
