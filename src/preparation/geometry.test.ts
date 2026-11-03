import { expect, it } from 'vitest'
import { createWavefunctionGeometry } from '../rendering/wavefunction'
import { packGeometry, unpackGeometry } from './geometry'

it('preserves surface attributes and bounds across a worker-style buffer transfer', () => {
  const source = createWavefunctionGeometry({ j: 2, m: 1, superposition: true, j2: 1, m2: 0, surfaceQuantity: 'jointProbability' })
  const packed = packGeometry(source)
  const moved = structuredClone(packed)
  const decoded = unpackGeometry(moved)
  for (const name of ['position', 'normal', 'color', 'waveDirection', 'wavePolar', 'waveDerivative']) expect(decoded.getAttribute(name).array).toEqual(source.getAttribute(name).array)
  expect(decoded.userData.waveEvolution).toEqual(source.userData.waveEvolution)
  expect(decoded.index!.array).toEqual(source.index!.array)
  expect(decoded.boundingSphere!.center.toArray()).toEqual(source.boundingSphere!.center.toArray())
  expect(decoded.boundingSphere!.radius).toBe(source.boundingSphere!.radius)
  source.dispose(); decoded.dispose()
})
