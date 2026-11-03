import * as THREE from 'three'
import { createParticleDepthPass } from '../../src/rendering/rotors'

declare global {
  interface Window { particleOcclusionResults: { overlapping: number[]; occluded: number[]; reordered: number[]; restored: number[]; moved: number[]; oldPosition: number[]; glError: number } }
}

const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setSize(96, 96)
renderer.setClearColor('#000000')
renderer.toneMapping = THREE.NoToneMapping
document.body.appendChild(renderer.domElement)
const target = new THREE.WebGLRenderTarget(96, 96)
const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 20)
camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0)
const geometry = new THREE.SphereGeometry(0.7, 32, 24)
const makeMaterial = (color: string) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false })
const red = makeMaterial('#ff0000'), blue = makeMaterial('#0000ff')
// Production uses separate geometries/VAOs for each atom mesh. Sharing one here
// would hide stale GPU bindings after a depth mesh disposes a shared attribute.
const firstGeometry = geometry.clone(), secondGeometry = geometry.clone()
const meshes = { rods: new THREE.InstancedMesh(geometry, red, 0), atomsA: new THREE.InstancedMesh(firstGeometry, red, 1), atomsB: new THREE.InstancedMesh(secondGeometry, blue, 1) }
meshes.atomsA.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0.6))
meshes.atomsB.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, -0.6))
for (const mesh of Object.values(meshes)) { mesh.frustumCulled = false; scene.add(mesh) }
const render = (x = 48) => {
  renderer.setRenderTarget(target); renderer.render(scene, camera)
  const pixel = new Uint8Array(4)
  renderer.readRenderTargetPixels(target, x, 48, 1, 1, pixel)
  return Array.from(pixel)
}
const overlapping = render()
const pass = createParticleDepthPass(meshes)
scene.add(pass.group); red.depthTest = blue.depthTest = true
const occluded = render()
meshes.atomsA.renderOrder = 20; meshes.atomsB.renderOrder = 10
const reordered = render()
scene.remove(pass.group); pass.dispose(); red.depthTest = blue.depthTest = false
const restored = render()
meshes.atomsA.setMatrixAt(0, new THREE.Matrix4().makeTranslation(1, 0, 0.6))
meshes.atomsB.setMatrixAt(0, new THREE.Matrix4().makeTranslation(1, 0, -0.6))
meshes.atomsA.instanceMatrix.needsUpdate = meshes.atomsB.instanceMatrix.needsUpdate = true
const moved = render(72), oldPosition = render()
window.particleOcclusionResults = { overlapping, occluded, reordered, restored, moved, oldPosition, glError: renderer.getContext().getError() }
target.dispose(); geometry.dispose(); firstGeometry.dispose(); secondGeometry.dispose(); red.dispose(); blue.dispose(); renderer.dispose()
