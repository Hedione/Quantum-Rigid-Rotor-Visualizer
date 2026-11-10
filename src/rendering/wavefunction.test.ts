import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWavefunctionGeometry, createWavefunctionSurface } from './wavefunction'
import { WAVE_COLORS } from './wave-colors'

describe('wavefunction surface orientation', () => {
  it.each(['probability', 'jointProbability'] as const)('uses one phase-independent color for %s', surfaceQuantity => {
    const geometry = createWavefunctionGeometry({ j: 2, m: 1, surfaceQuantity })
    const colors = geometry.getAttribute('color'), expected = new THREE.Color('#72d6b0')
    for (let i = 0; i < colors.count; i++) for (const [axis, value] of [expected.r, expected.g, expected.b].entries()) expect(colors.array[i * 3 + axis]).toBeCloseTo(value, 6)
    expect(geometry.hasAttribute('wavePolar')).toBe(true)
    geometry.dispose()
  })
  it.each(['real', 'imaginary'] as const)('colors %s by positive/negative sign only', surfaceQuantity => {
    const geometry = createWavefunctionGeometry({ j: 2, m: 1, surfaceQuantity })
    const colors = geometry.getAttribute('color')
    const positive = new THREE.Color(surfaceQuantity === 'real' ? WAVE_COLORS.realPositive : WAVE_COLORS.imaginaryPositive)
    const negative = new THREE.Color(surfaceQuantity === 'real' ? WAVE_COLORS.realNegative : WAVE_COLORS.imaginaryNegative)
    let positiveCount = 0, negativeCount = 0
    for (let i = 0; i < colors.count; i++) {
      const color = new THREE.Color().fromBufferAttribute(colors, i)
      const distance = (reference: THREE.Color) => Math.abs(reference.r - color.r) + Math.abs(reference.g - color.g) + Math.abs(reference.b - color.b)
      if (distance(positive) < 1e-6) positiveCount++
      else { expect(distance(negative)).toBeLessThan(1e-6); negativeCount++ }
    }
    expect(positiveCount).toBeGreaterThan(100); expect(negativeCount).toBeGreaterThan(100)
    geometry.dispose()
  })
  it('assigns distinct colors to the four complex axes and closes the phase seam', () => {
    const geometry = createWavefunctionGeometry({ j: 1, m: 1, surfaceQuantity: 'magnitude' })
    const { widthSegments: width, heightSegments: height } = geometry.parameters
    const colors = geometry.getAttribute('color'), row = height / 2
    // Y₁¹ has negative polar amplitude: φ = π, 3π/2, 2π, 5π/2 gives 0, π/2, π, −π/2.
    for (const [col, hex] of [[0, '#72d6b0'], [width / 4, '#8faaf0'], [width / 2, '#ed93b6'], [3 * width / 4, '#f0b887'], [width, '#72d6b0']] as const) {
      const actual = new THREE.Color().fromBufferAttribute(colors, row * (width + 1) + col)
      expect(actual.toArray()).toEqual(new THREE.Color(hex).toArray().map(value => expect.closeTo(value, 6)))
    }
    geometry.dispose()
  })
  it('writes opaque depth and color together while preserving nearest-surface transparency', () => {
    const geometry = createWavefunctionGeometry({ j: 2, m: 1, surfaceQuantity: 'magnitude' })
    const opaque = createWavefunctionSurface(geometry), translucent = createWavefunctionSurface(geometry, 0.5)
    expect(opaque.group.getObjectByName('wavefunction-depth')).toBeUndefined()
    expect(opaque.material.depthWrite).toBe(true)
    expect(translucent.group.getObjectByName('wavefunction-depth')).toBeDefined()
    expect(translucent.material.depthWrite).toBe(false)
    opaque.dispose(); translucent.dispose(); geometry.dispose()
  })
  it.each([[150, 150], [200, 100], [200, 200]])('builds finite, resolved high-J geometry for J=%i, m=%i', (j, m) => {
    const geometry = createWavefunctionGeometry({ j, m, surfaceQuantity: 'real' })
    for (const attribute of ['position', 'normal', 'color']) expect(geometry.getAttribute(attribute).array.every(Number.isFinite)).toBe(true)
    expect(geometry.boundingSphere!.radius).toBeGreaterThan(1)
    expect(geometry.boundingSphere!.radius).toBeLessThan(2.01)
    expect(geometry.getAttribute('position').count).toBeGreaterThan(25000)
    geometry.dispose()
  })
  it.each([[1, 0], [2, 1], [10, 5]])('preserves outward triangle winding for J=%i, m=%i', (j, m) => {
    const geometry = createWavefunctionGeometry({ j, m, surfaceQuantity: 'magnitude' })
    const positions = geometry.attributes.position, indices = geometry.index!
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), normal = new THREE.Vector3(), center = new THREE.Vector3()
    let outward = 0, inward = 0
    for (let i = 0; i < indices.count; i += 3) {
      a.fromBufferAttribute(positions, indices.getX(i)); b.fromBufferAttribute(positions, indices.getX(i + 1)); c.fromBufferAttribute(positions, indices.getX(i + 2))
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a))
      center.copy(a).add(b).add(c).divideScalar(3)
      const radialNormal = normal.dot(center)
      if (radialNormal > 1e-12) outward++
      if (radialNormal < -1e-12) inward++
    }
    expect(outward).toBeGreaterThan(1000)
    expect(inward).toBe(0)
    geometry.dispose()
  })
})
