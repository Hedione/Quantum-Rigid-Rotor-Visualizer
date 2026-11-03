import * as THREE from 'three'
import { createWavefunctionGeometry, createWavefunctionSurface } from '../../src/rendering/wavefunction'

interface Result { quantity: string; opacity: number; camera: number[]; covered: number; lowerLobeDifferences: number; orderDifferences: number }
declare global { interface Window { occlusionResults: { cases: Result[]; oldPipelineDifferences: number } } }

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true })
renderer.setSize(192, 192)
renderer.setClearColor(0x000000, 0)
document.body.style.background = '#0d1723'
document.body.appendChild(renderer.domElement)
const target = new THREE.WebGLRenderTarget(192, 192)
const scene = new THREE.Scene()
scene.add(new THREE.AmbientLight(0xffffff, 1.5))
const light = new THREE.DirectionalLight(0xffffff, 2.4)
light.position.set(3, -4, 6)
scene.add(light)
const camera = new THREE.OrthographicCamera(-2.3, 2.3, 2.3, -2.3, 0.1, 30)

function render(geometry: THREE.BufferGeometry, opacity: number, broken = false, capture = false) {
  const surface = createWavefunctionSurface(geometry, opacity)
  if (broken) {
    surface.group.remove(surface.group.getObjectByName('wavefunction-depth')!)
    surface.material.side = THREE.DoubleSide
    surface.material.needsUpdate = true
  }
  scene.add(surface.group)
  renderer.setRenderTarget(target)
  renderer.render(scene, camera)
  const pixels = new Uint8Array(192 * 192 * 4)
  renderer.readRenderTargetPixels(target, 0, 0, 192, 192, pixels)
  if (capture) { renderer.setRenderTarget(null); renderer.render(scene, camera) }
  scene.remove(surface.group)
  surface.dispose()
  return pixels
}

function differences(a: Uint8Array, b: Uint8Array, mask?: Uint8Array) {
  let pixels = 0
  for (let i = 0; i < a.length; i += 4) {
    if (mask && mask[i + 3] < 20) continue
    if ([0, 1, 2, 3].some(channel => Math.abs(a[i + channel] - b[i + channel]) > 2)) pixels++
  }
  return pixels
}

const cases: Result[] = []
let oldPipelineDifferences = 0
for (const quantity of ['magnitude', 'probability', 'real', 'imaginary'] as const) {
  const geometry = createWavefunctionGeometry({ j: 2, m: 1, surfaceQuantity: quantity })
  const positions = geometry.attributes.position, index = geometry.index!
  const top = geometry.clone(), reversed = geometry.clone()
  const topIndices: number[] = [], reversedIndices: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const indices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    if (indices.every(vertex => positions.getZ(vertex) >= -1e-8)) topIndices.push(...indices)
  }
  for (let i = index.count - 3; i >= 0; i -= 3) reversedIndices.push(index.getX(i), index.getX(i + 1), index.getX(i + 2))
  top.setIndex(topIndices)
  reversed.setIndex(reversedIndices)
  for (const opacity of [0.25, 0.88, 1]) for (const position of [[0.15, -0.1, 8], [3, -3, 7], [-4, 2, 6]]) {
    camera.position.fromArray(position)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const capture = quantity === 'magnitude' && opacity === 0.88 && position[2] === 8
    const full = render(geometry, opacity, false, capture)
    const upperOnly = render(top, opacity)
    const reordered = render(reversed, opacity)
    let covered = 0
    for (let i = 3; i < upperOnly.length; i += 4) if (upperOnly[i] >= 20) covered++
    cases.push({ quantity, opacity, camera: position, covered, lowerLobeDifferences: differences(full, upperOnly, upperOnly), orderDifferences: differences(full, reordered) })
    if (capture) oldPipelineDifferences = differences(render(geometry, opacity, true), upperOnly, upperOnly)
  }
  geometry.dispose(); top.dispose(); reversed.dispose()
}
window.occlusionResults = { cases, oldPipelineDifferences }
target.dispose()
renderer.dispose()
