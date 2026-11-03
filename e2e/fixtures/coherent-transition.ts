import * as THREE from 'three'
import { createWavefunctionGeometry } from '../../src/rendering/wavefunction'
import { createSurfaceEvolution, vertexEvolution } from '../../src/rendering/evolving-surface'
import { createAngularWavefunction } from '../../src/physics/superposition'
import { laboratoryCoefficients, rabiCoefficients } from '../../src/physics/transition'
import { packGeometry, unpackGeometry } from '../../src/preparation/geometry'
import type { SurfaceQuantity } from '../../src/types'

declare global { interface Window { coherentGPU: { cases: { state: number[]; quantity: string; progress: number; error: number; endpointError?: number }[] } } }
const renderer = new THREE.WebGLRenderer({ antialias: false })
const camera = new THREE.Camera(), scene = new THREE.Scene()
const cases: Window['coherentGPU']['cases'] = []
for (const [j, m, j2, m2] of [[1, 1, 2, 0], [0, 0, 1, 0], [50, -50, 49, -49]]) {
  const state = { j, m, j2, m2, superposition: true, coherentTransition: true }
  const wave = createAngularWavefunction(state)
  for (const quantity of ['magnitude', 'probability', 'jointProbability', 'real', 'imaginary'] as SurfaceQuantity[]) {
    const source = createWavefunctionGeometry({ ...state, surfaceQuantity: quantity })
    // Exercise the worker serialization path, including the cached envelope.
    const geometry = unpackGeometry(structuredClone(packGeometry(source)))
    const controllerMaterial = new THREE.MeshBasicMaterial(), evolution = createSurfaceEvolution([controllerMaterial])
    evolution.setGeometry(geometry)
    const shader = { uniforms: {}, vertexShader: '' } as unknown as Parameters<THREE.Material['onBeforeCompile']>[0]
    controllerMaterial.onBeforeCompile(shader, renderer)
    const count = geometry.getAttribute('position').count, width = 512, height = Math.ceil(count / width)
    const captureGeometry = geometry.clone(), pixels = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) { pixels[i * 3] = 2 * ((i % width + 0.5) / width) - 1; pixels[i * 3 + 1] = 2 * ((Math.floor(i / width) + 0.5) / height) - 1 }
    captureGeometry.setAttribute('position', new THREE.BufferAttribute(pixels, 3)); captureGeometry.setIndex(null)
    const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: shader.uniforms,
      vertexShader: `precision highp float;\n#define attribute in\n${vertexEvolution}\nin vec3 position; out vec3 captured; void main() { captured = evolveWave().position; gl_Position = vec4(position,1.0); gl_PointSize = 1.0; }`,
      fragmentShader: 'precision highp float; in vec3 captured; out vec4 result; void main() { result = vec4(captured,1.0); }',
    })
    const points = new THREE.Points(captureGeometry, material); points.frustumCulled = false; scene.add(points)
    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, depthBuffer: false })
    for (const progress of [0, 0.5, 1]) {
      const c = laboratoryCoefficients(rabiCoefficients(progress * Math.PI, 1, 0.73), progress * 2.1, progress * 8.4)
      evolution.setCoefficients(c, true)
      renderer.setRenderTarget(target); renderer.render(scene, camera)
      const values = new Float32Array(width * height * 4); renderer.readRenderTargetPixels(target, 0, 0, width, height, values)
      const maxima = shader.uniforms.waveMaxima.value as THREE.Vector3
      const maximum = quantity === 'jointProbability' ? maxima.z : quantity === 'probability' ? maxima.y : maxima.x
      const directions = geometry.getAttribute('waveDirection')
      const { widthSegments: columns, heightSegments: rows } = source.parameters
      let error = 0, endpointError = 0
      const eigen = progress === 0 || progress === 1 ? createAngularWavefunction({ j: progress === 0 ? j : j2, m: progress === 0 ? m : m2 }) : undefined
      let eigenMaximum = 0
      if (eigen && (quantity === 'probability' || quantity === 'jointProbability')) for (let row = 0; row <= rows; row++) {
        const theta = row * Math.PI / rows
        eigenMaximum = Math.max(eigenMaximum, eigen.evaluate(Math.cos(theta), 0).probability * (quantity === 'jointProbability' ? Math.sin(theta) : 1))
      }
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / (columns + 1)), col = i % (columns + 1), u = Math.cos(row * Math.PI / rows), phi = Math.PI + col * 2 * Math.PI / columns
        const psi = wave.evaluate(u, phi, 0, 0, c)
        const st = Math.sin(row * Math.PI / rows)
        const value = quantity === 'probability' ? psi.probability : quantity === 'jointProbability' ? psi.probability * st : quantity === 'real' ? Math.abs(psi.re) : quantity === 'imaginary' ? Math.abs(psi.im) : psi.magnitude
        const direction = new THREE.Vector3().fromBufferAttribute(directions, i).normalize()
        for (let axis = 0; axis < 3; axis++) error = Math.max(error, Math.abs(values[i * 4 + axis] - direction.getComponent(axis) * value * 1.9 / maximum))
        if (eigen && eigenMaximum > 0) {
          const expected = eigen.evaluate(u, phi).probability * (quantity === 'jointProbability' ? st : 1) * 1.9 / eigenMaximum
          endpointError = Math.max(endpointError, Math.abs(Math.hypot(values[i * 4], values[i * 4 + 1], values[i * 4 + 2]) - expected))
        }
      }
      cases.push({ state: [j, m, j2, m2], quantity, progress, error, endpointError: eigenMaximum > 0 ? endpointError : undefined })
    }
    scene.remove(points); target.dispose(); material.dispose(); controllerMaterial.dispose(); captureGeometry.dispose(); geometry.dispose(); source.dispose()
  }
}
renderer.dispose()
window.coherentGPU = { cases }
