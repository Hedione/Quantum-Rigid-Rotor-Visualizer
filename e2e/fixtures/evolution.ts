import * as THREE from 'three'
import { createWavefunctionGeometry, createWavefunctionSurface } from '../../src/rendering/wavefunction'
import { createAngularWavefunction } from '../../src/physics/superposition'
import type { SurfaceQuantity } from '../../src/types'
import type { WaveEvolutionData } from '../../src/rendering/evolving-surface'
import { createSurfaceEvolution, vertexEvolution } from '../../src/rendering/evolving-surface'

interface Case { quantity: string; phases: number[]; covered: number; referenceCovered: number; mismatches: number; interiorMismatches: number; positionError?: number }
declare global { interface Window { evolutionPixels: { cases: Case[]; changedJointPixels: number } } }
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
renderer.setSize(320, 320); renderer.setClearColor('#000000'); document.body.appendChild(renderer.domElement)
const camera = new THREE.OrthographicCamera(-2.3, 2.3, 2.3, -2.3, 0.1, 30)
camera.up.set(0, 0, 1); camera.position.set(4, -6, 3); camera.lookAt(0, 0, 0)
const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight('#ffffff', 3))
const target = new THREE.WebGLRenderTarget(320, 320)
const positionError = (source: THREE.BufferGeometry, reference: THREE.BufferGeometry, phases: number[]) => {
  const count = source.getAttribute('position').count, width = 512, height = Math.ceil(count / width)
  const points = new THREE.BufferGeometry(), positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) { positions[i * 3] = 2 * ((i % width + 0.5) / width) - 1; positions[i * 3 + 1] = 2 * ((Math.floor(i / width) + 0.5) / height) - 1 }
  points.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  points.setAttribute('waveDirection', source.getAttribute('waveDirection').clone())
  points.setAttribute('wavePolar', source.getAttribute('wavePolar').clone())
  points.setAttribute('waveDerivative', source.getAttribute('waveDerivative').clone())
  const data = source.userData.waveEvolution as WaveEvolutionData
  const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3,
    uniforms: { waveEnabled: { value: 1 }, wavePhases: { value: new THREE.Vector4(Math.cos(phases[0]), Math.sin(phases[0]), Math.cos(phases[1]), Math.sin(phases[1])) }, waveModes: { value: new THREE.Vector4(data.m, data.m2, data.normalization, 2) }, waveMaxima: { value: new THREE.Vector3(...data.maxima) }, wavePhaseColor: { value: 0 }, waveCyan: { value: new THREE.Color('white') }, waveViolet: { value: new THREE.Color('white') } },
    vertexShader: `precision highp float;\n#define PI 3.141592653589793\n#define attribute in\n${vertexEvolution}\nin vec3 position; out vec3 captured; void main() { captured = evolveWave().position; gl_Position = vec4(position, 1.0); gl_PointSize = 1.0; }`,
    fragmentShader: 'precision highp float; in vec3 captured; out vec4 result; void main() { result = vec4(captured, 1.0); }',
  })
  const capture = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, depthBuffer: false })
  const pointScene = new THREE.Scene(), mesh = new THREE.Points(points, material); mesh.frustumCulled = false; pointScene.add(mesh)
  renderer.setRenderTarget(capture); renderer.render(pointScene, camera)
  const values = new Float32Array(width * height * 4); renderer.readRenderTargetPixels(capture, 0, 0, width, height, values)
  let error = 0
  const expected = reference.getAttribute('position')
  for (let i = 0; i < count; i++) for (let axis = 0; axis < 3; axis++) {
    const difference = Math.abs(values[i * 4 + axis] - expected.array[i * 3 + axis])
    if (difference > error) error = difference
  }
  capture.dispose(); material.dispose(); points.dispose()
  return error
}
// Compare geometric coverage independently of the two normal-generation methods.
const unlitCoverage = (surface: ReturnType<typeof createWavefunctionSurface>, geometry: THREE.BufferGeometry) => {
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false })
  ;(surface.group.getObjectByName('wavefunction-color') as THREE.Mesh).material = material
  const evolution = geometry.hasAttribute('wavePolar') ? createSurfaceEvolution([material]) : undefined
  evolution?.setGeometry(geometry)
  return { material, evolution }
}
const mask = (group: THREE.Group) => {
  scene.add(group); renderer.setRenderTarget(target); renderer.render(scene, camera)
  const pixels = new Uint8Array(320 * 320 * 4); renderer.readRenderTargetPixels(target, 0, 0, 320, 320, pixels)
  scene.remove(group)
  return Uint8Array.from({ length: 320 * 320 }, (_, i) => Number(pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2] > 20))
}
const cases: Case[] = []
let firstJoint: Uint8Array | undefined, changedJointPixels = 0
for (const high of [false, true]) {
const state = { j: high ? 50 : 0, m: 0, j2: high ? 49 : 1, m2: high ? 1 : 0, superposition: true }
const wave = createAngularWavefunction(state)
for (const quantity of (high ? ['jointProbability'] : ['magnitude', 'probability', 'jointProbability', 'real', 'imaginary']) as SurfaceQuantity[]) {
  const geometry = createWavefunctionGeometry({ ...state, surfaceQuantity: quantity }), animated = createWavefunctionSurface(geometry)
  const coverage = unlitCoverage(animated, geometry)
  const data = geometry.userData.waveEvolution as WaveEvolutionData
  const direction = geometry.getAttribute('waveDirection')
  const maximum = data.maxima[quantity === 'jointProbability' ? 2 : quantity === 'probability' ? 1 : 0]
  for (const phases of high ? [[0.4, 1.9]] : [[0, 0], [0.4, 1.9], [2.1, 0.2], [0, Math.PI]]) {
    animated.evolution!.setPhases(phases[0], phases[1], true)
    coverage.evolution!.setPhases(phases[0], phases[1], true)
    const actual = mask(animated.group)
    const reference = geometry.clone(); reference.deleteAttribute('wavePolar'); reference.deleteAttribute('waveDirection')
    const positions = reference.getAttribute('position')
    const { widthSegments, heightSegments } = geometry.parameters
    for (let i = 0; i < positions.count; i++) {
      const length = Math.hypot(direction.getX(i), direction.getY(i), direction.getZ(i))
      const x = direction.getX(i) / length, y = direction.getY(i) / length, z = direction.getZ(i) / length
      // Evaluate the mesh's exact angular grid. Reconstructing theta from its
      // rounded float32 z coordinate perturbs the rapidly oscillating high-J roots.
      const row = Math.floor(i / (widthSegments + 1)), col = i % (widthSegments + 1)
      const psi = wave.evaluate(Math.cos(row * Math.PI / heightSegments), Math.PI + col * 2 * Math.PI / widthSegments, phases[0], phases[1])
      const value = quantity === 'probability' ? psi.probability : quantity === 'jointProbability' ? psi.probability * Math.hypot(x, y) : quantity === 'real' ? Math.abs(psi.re) : quantity === 'imaginary' ? Math.abs(psi.im) : psi.magnitude
      const r = value * 1.9 / maximum
      positions.setXYZ(i, x * r, y * r, z * r)
    }
    reference.computeVertexNormals()
    const expectedSurface = createWavefunctionSurface(reference), referenceCoverage = unlitCoverage(expectedSurface, reference), expected = mask(expectedSurface.group)
    const boundary = (pixels: Uint8Array, index: number) => {
      const x = index % 320, y = Math.floor(index / 320)
      let zero = false, one = false
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= 320 || y + dy < 0 || y + dy >= 320) continue
        if (pixels[(y + dy) * 320 + x + dx]) one = true; else zero = true
      }
      return zero && one
    }
    let mismatches = 0, interiorMismatches = 0
    for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) {
      mismatches++
      if (!boundary(actual, i) || !boundary(expected, i)) interiorMismatches++
    }
    cases.push({ quantity: `${quantity}${high ? ' (J=50+49)' : ''}`, phases, covered: actual.reduce((a, b) => a + b, 0), referenceCovered: expected.reduce((a, b) => a + b, 0), mismatches, interiorMismatches, positionError: high ? positionError(geometry, reference, phases) : undefined })
    if (quantity === 'jointProbability' && phases[0] === 0) {
      if (!firstJoint) firstJoint = actual
      else for (let i = 0; i < actual.length; i++) if (actual[i] !== firstJoint[i]) changedJointPixels++
    }
    referenceCoverage.material.dispose(); expectedSurface.dispose(); reference.dispose()
  }
  if (quantity === 'jointProbability') { scene.add(animated.group); renderer.setRenderTarget(null); renderer.render(scene, camera); scene.remove(animated.group) }
  coverage.material.dispose(); animated.dispose(); geometry.dispose()
}
}
target.dispose()
window.evolutionPixels = { cases, changedJointPixels }
