import * as THREE from 'three'
import { createAngularWavefunction, type CoherentState } from '../physics/superposition'
import type { Settings } from '../types'
import { attachEvolutionAttributes, createSurfaceEvolution } from './evolving-surface'

type SurfaceSettings = CoherentState & Pick<Settings, 'surfaceQuantity' | 'phaseColor'>

export function createWavefunctionGeometry(settings: SurfaceSettings, overlay = false) {
  const { j, m, surfaceQuantity, phaseColor } = settings
  const secondJ = settings.superposition ? settings.j2 ?? 2 : j, secondM = settings.superposition ? settings.m2 ?? 1 : m
  const width = Math.max(192, 8 * Math.abs(m), 8 * Math.abs(secondM), settings.superposition ? 8 * Math.abs(m - secondM) : 0)
  const height = Math.max(128, 8 * (j - Math.abs(m) + 1), 8 * (secondJ - Math.abs(secondM) + 1), Math.ceil(16 * Math.sqrt(Math.max(j, secondJ) + 1)))
  const mesh = new THREE.SphereGeometry(1, width, height)
  const positions = mesh.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const values = new Float32Array(positions.count)
  const phases = new Float32Array(positions.count)
  const directions = new Float32Array(positions.count * 3)
  const wave = createAngularWavefunction(settings)
  const firstLatitudes = new Float64Array(height + 1), secondLatitudes = new Float64Array(height + 1)
  const cosine = new Float64Array(width + 1), sine = new Float64Array(width + 1)
  const cosine2 = new Float64Array(width + 1), sine2 = new Float64Array(width + 1)
  for (let x = 0; x <= width; x++) {
    // Lab coordinates are (-cos(t) sin(theta), -sin(t) sin(theta), cos(theta)).
    const phi = Math.PI + 2 * Math.PI * x / width
    cosine[x] = Math.cos(m * phi); sine[x] = Math.sin(m * phi)
    cosine2[x] = Math.cos(secondM * phi); sine2[x] = Math.sin(secondM * phi)
  }
  let maximum = 0
  const color = new THREE.Color(), cyan = new THREE.Color('#54dfca'), violet = new THREE.Color('#a58bf4')
  // Only one normalized Legendre recurrence per latitude, rather than per vertex.
  for (let row = 0; row <= height; row++) {
    const theta = Math.PI * row / height, u = Math.cos(theta)
    const first = wave.a(u), second = wave.b?.(u) ?? 0
    firstLatitudes[row] = first; secondLatitudes[row] = second
    const sinTheta = Math.sin(theta)
    for (let col = 0; col <= width; col++) {
      const i = row * (width + 1) + col
      // Proper rotation to lab z preserves outward face winding.
      directions.set([positions.getX(i), -positions.getZ(i), positions.getY(i)], i * 3)
      const re = (first * cosine[col] + second * cosine2[col]) / wave.normalization, im = (first * sine[col] + second * sine2[col]) / wave.normalization
      const probability = re * re + im * im
      const value = overlay || surfaceQuantity === 'probability' ? probability : surfaceQuantity === 'jointProbability' ? probability * sinTheta : surfaceQuantity === 'real' ? re : surfaceQuantity === 'imaginary' ? im : Math.hypot(re, im)
      values[i] = Math.abs(value)
      phases[i] = surfaceQuantity === 'jointProbability' && !overlay ? 0 : phaseColor ? Math.atan2(im, re) : value < 0 ? Math.PI : 0
      maximum = Math.max(maximum, Math.abs(value))
    }
  }
  for (let i = 0; i < positions.count; i++) {
    const radius = maximum > 1e-12 ? 1.9 * values[i] / maximum : 0
    positions.setXYZ(i, directions[i * 3] * radius, directions[i * 3 + 1] * radius, directions[i * 3 + 2] * radius)
    color.copy(cyan).lerp(violet, (1 - Math.cos(phases[i])) / 2)
    if (phaseColor) color.offsetHSL(Math.sin(phases[i]) * 0.07, 0, 0)
    color.toArray(colors, i * 3)
  }
  mesh.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  mesh.computeVertexNormals()
  mesh.computeBoundingSphere()
  if (settings.superposition && !overlay) attachEvolutionAttributes(mesh, directions, firstLatitudes, secondLatitudes, width, { m, m2: secondM, normalization: wave.normalization, quantity: surfaceQuantity, phaseColor })
  return mesh
}

/** Resolve the nearest surface before shading, independent of triangle draw order. */
export function createWavefunctionSurface(geometry: THREE.BufferGeometry, opacity = 1, overlay = false) {
  const group = new THREE.Group()
  let depthMaterial: THREE.MeshBasicMaterial | undefined
  if (!overlay) {
    depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true, side: THREE.FrontSide })
    const depth = new THREE.Mesh(geometry, depthMaterial)
    depth.name = 'wavefunction-depth'
    depth.renderOrder = -1
    group.add(depth)
  }
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true, side: overlay ? THREE.DoubleSide : THREE.FrontSide,
    transparent: overlay || opacity < 1, opacity: overlay ? 0.16 : opacity, depthTest: true, depthWrite: false,
    roughness: 0.26, metalness: 0.12, clearcoat: 0.5,
  })
  const surface = new THREE.Mesh(geometry, material)
  surface.name = 'wavefunction-color'
  surface.renderOrder = overlay ? 0 : 1
  group.add(surface)
  const evolution = geometry.hasAttribute('wavePolar') ? createSurfaceEvolution(depthMaterial ? [depthMaterial, material] : [material]) : undefined
  if (evolution) evolution.setGeometry(geometry)
  for (const child of group.children) child.frustumCulled = false
  return { group, material, evolution, setGeometry(next: THREE.BufferGeometry) { for (const child of group.children) (child as THREE.Mesh).geometry = next; evolution?.setGeometry(next) }, dispose() { depthMaterial?.dispose(); material.dispose() } }
}
