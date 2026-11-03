import * as THREE from 'three'
import { createWavefunctionGeometry, createWavefunctionSurface } from '../../src/rendering/wavefunction'
import { createSurfaceEvolution } from '../../src/rendering/evolving-surface'

interface Result { j: number; quantity: string; phase: number; holes: number; covered: number }
declare global { interface Window { surfaceRendering: { cases: Result[]; legacyHoles: number; glError: number } } }
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
const size = 160
renderer.setSize(size, size); renderer.setClearColor(0, 0); document.body.appendChild(renderer.domElement)
const target = new THREE.WebGLRenderTarget(size, size)
const scene = new THREE.Scene()
scene.add(new THREE.AmbientLight('white', 3))
const camera = new THREE.PerspectiveCamera(40, 1, .1, 80)
camera.up.set(0, 0, 1)
const render = () => {
  renderer.setRenderTarget(target); renderer.render(scene, camera)
  const pixels = new Uint8Array(size * size * 4)
  renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
  return pixels
}
const cases: Result[] = []
let legacyHoles = 0
for (const [j, m] of [[2, 1], [10, 4], [50, 49]]) for (const quantity of ['magnitude', 'probability', 'jointProbability', 'real', 'imaginary'] as const) {
  const geometry = createWavefunctionGeometry({ j, m, superposition: true, j2: j - 1, m2: m - 1, surfaceQuantity: quantity })
  const surface = createWavefunctionSurface(geometry)
  const legacyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true, side: THREE.FrontSide })
  const legacyDepth = new THREE.Mesh(geometry, legacyMaterial)
  legacyDepth.renderOrder = -1; legacyDepth.visible = false; legacyDepth.frustumCulled = false
  surface.group.add(legacyDepth)
  const legacyEvolution = createSurfaceEvolution([legacyMaterial]); legacyEvolution.setGeometry(geometry)
  scene.add(surface.group)
  for (const phase of [0, .63, 1.91]) for (const position of [[4, -6, 3], [-5, 2, 4]]) {
    camera.position.fromArray(position); camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
    surface.evolution!.setPhases(phase, phase * 1.7, true)
    const actual = render()
    // Independent opaque reference: depth and shaded color are written by the same fragment.
    const depth = surface.group.getObjectByName('wavefunction-depth')
    if (depth) depth.visible = false
    surface.material.depthWrite = true
    const reference = render()
    legacyEvolution.setPhases(phase, phase * 1.7, true)
    legacyDepth.visible = true; surface.material.depthWrite = false
    const legacy = render()
    legacyDepth.visible = false
    if (depth) depth.visible = true
    surface.material.depthWrite = !depth
    let covered = 0, holes = 0
    const lit = (pixels: Uint8Array, i: number) => pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2] > 30
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const i = y * size + x
      if (!lit(reference, i)) continue
      covered++
      let interior = true
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) interior &&= lit(reference, i + dy * size + dx)
      if (interior && !lit(actual, i)) holes++
      if (interior && !lit(legacy, i)) legacyHoles++
    }
    cases.push({ j, quantity, phase, covered, holes })
  }
  scene.remove(surface.group); surface.dispose(); legacyMaterial.dispose(); geometry.dispose()
}
window.surfaceRendering = { cases, legacyHoles, glError: renderer.getContext().getError() }
target.dispose(); renderer.dispose()
