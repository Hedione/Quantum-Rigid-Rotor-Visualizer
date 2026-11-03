import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { defaultSettings } from '../types'
import { getMolecularParameters } from './molecule'
import { ATOMIC_MASS, molecularParameters, quantumQuantities } from './quantum'
import { atomPositions } from './classical'
import { OrientationEnsemble } from './sampling'
import { ENSEMBLE_ATOM_RADIUS, ENSEMBLE_ATOM_RADIUS_PM, ROTOR_DISPLAY_UNITS_PER_ANGSTROM, updateEnsembleMeshes } from './instancing'

describe('unequal-mass rigid rotors', () => {
  it('links masses in symmetric mode and restores the independent mass in asymmetric mode', () => {
    const settings = { ...defaultSettings, atomMass: 12, atomMass2: 16 }
    const symmetric = getMolecularParameters(settings)
    expect(symmetric.mass2).toBe(12)
    expect(symmetric.reducedMass / ATOMIC_MASS).toBe(6)
    const asymmetric = getMolecularParameters({ ...settings, asymmetricBond: true })
    expect(asymmetric.mass2).toBe(16)
    expect(asymmetric.reducedMass / ATOMIC_MASS).toBeCloseTo(12 * 16 / 28, 14)
  })

  it.each([[1, 2], [12, 16], [200, 0.1]])('keeps the physical center fixed for masses %s and %s', (mass1, mass2) => {
    const model = molecularParameters(mass1, 0.74, mass2)
    for (const phase of [0, 0.37, Math.PI / 2, 4.8]) {
      const [a, b] = atomPositions([0, 0, 1], phase, model.separation, mass1, mass2)
      const separation = Math.hypot(...a.map((x, i) => x - b[i]))
      expect(separation / model.separation).toBeCloseTo(1, 14)
      for (let k = 0; k < 3; k++) expect((mass1 * a[k] + mass2 * b[k]) / separation).toBeCloseTo(0, 12)
      const inertia = ATOMIC_MASS * (mass1 * a.reduce((sum, x) => sum + x * x, 0) + mass2 * b.reduce((sum, x) => sum + x * x, 0))
      expect(inertia / model.inertia).toBeCloseTo(1, 13)
      const q = quantumQuantities(2, 1, model.inertia)
      expect(0.5 * inertia * q.omega ** 2 / q.energy).toBeCloseTo(1, 13)
    }
  })

  it('moves live instance endpoints and the bond midpoint around the mass center, including after resizing', () => {
    const engine = new OrientationEnsemble(2, 1, 123, 19)
    const geometry = new THREE.SphereGeometry(1, 4, 4), material = new THREE.MeshBasicMaterial()
    const meshes = { rods: new THREE.InstancedMesh(geometry, material, 100), atomsA: new THREE.InstancedMesh(geometry, material, 100), atomsB: new THREE.InstancedMesh(geometry, material, 100) }
    const object = new THREE.Object3D(), vector = new THREE.Vector3(), matrix = new THREE.Matrix4()
    const a = new THREE.Vector3(), b = new THREE.Vector3(), middle = new THREE.Vector3()
    for (const count of [19, 31, 7]) for (const [mass1, mass2] of [[1, 2], [16, 12], [1, 1]]) {
      engine.setCount(count)
      updateEnsembleMeshes(engine, meshes, 1.1, object, vector, mass2 / (mass1 + mass2))
      expect(meshes.atomsA.count).toBe(count)
      for (let i = 0; i < count; i++) {
        meshes.atomsA.getMatrixAt(i, matrix); a.setFromMatrixPosition(matrix)
        meshes.atomsB.getMatrixAt(i, matrix); b.setFromMatrixPosition(matrix)
        meshes.rods.getMatrixAt(i, matrix); middle.setFromMatrixPosition(matrix)
        expect(a.distanceTo(b)).toBeCloseTo(2.2, 6)
        expect(a.clone().multiplyScalar(mass1).addScaledVector(b, mass2).length()).toBeLessThan(2e-6)
        expect(middle.distanceTo(a.clone().add(b).multiplyScalar(0.5))).toBeLessThan(2e-7)
        expect(new THREE.Vector3().setFromMatrixScale(matrix).y).toBeCloseTo(2.2, 6)
      }
    }
    Object.values(meshes).forEach(mesh => mesh.dispose()); geometry.dispose(); material.dispose()
  })

  it('resizes ensemble atoms while preserving bond transforms, centers, and samples', () => {
    const engine = new OrientationEnsemble(2, 1, 42, 13)
    const material = new THREE.MeshBasicMaterial()
    const meshes = {
      rods: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 6), material, 13),
      atomsA: new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 8, 6), material, 13),
      atomsB: new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 8, 6), material, 13),
    }
    const object = new THREE.Object3D(), vector = new THREE.Vector3(), matrix = new THREE.Matrix4()
    const samples = Array.from(engine.orientations)
    for (const fraction of [0.5, 16 / 28]) {
      updateEnsembleMeshes(engine, meshes, 1.1, object, vector, fraction)
      const bonds = Array.from(meshes.rods.instanceMatrix.array)
      const centers = [meshes.atomsA, meshes.atomsB].map(mesh => Array.from({ length: 13 }, (_, i) => {
        mesh.getMatrixAt(i, matrix)
        return new THREE.Vector3().setFromMatrixPosition(matrix).toArray()
      }))
      for (const scale of [3, 0.25, 1.5, 1]) {
        updateEnsembleMeshes(engine, meshes, 1.1, object, vector, fraction, scale)
        expect(Array.from(meshes.rods.instanceMatrix.array)).toEqual(bonds)
        for (const [index, mesh] of [meshes.atomsA, meshes.atomsB].entries()) for (let i = 0; i < 13; i++) {
          mesh.getMatrixAt(i, matrix)
          expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual(centers[index][i])
          for (const dimension of new THREE.Vector3().setFromMatrixScale(matrix).toArray()) expect(dimension).toBeCloseTo(scale, 6)
        }
        expect(Array.from(engine.orientations)).toEqual(samples)
      }
    }
    for (const mesh of Object.values(meshes)) { mesh.dispose(); mesh.geometry.dispose() }
    material.dispose()
  })

  it.each([0.2, 0.74, 3])('keeps the picometer radius calibrated to a %s Å bond', bondLength => {
    const engine = new OrientationEnsemble(1, 0, 42, 1)
    const material = new THREE.MeshBasicMaterial(), geometry = new THREE.SphereGeometry(ENSEMBLE_ATOM_RADIUS)
    const meshes = { rods: new THREE.InstancedMesh(geometry, material, 1), atomsA: new THREE.InstancedMesh(geometry, material, 1), atomsB: new THREE.InstancedMesh(geometry, material, 1) }
    const object = new THREE.Object3D(), vector = new THREE.Vector3(), matrix = new THREE.Matrix4()
    for (const radius of [0.5, defaultSettings.ensembleAtomRadius, 10]) {
      const scale = radius / ENSEMBLE_ATOM_RADIUS_PM
      updateEnsembleMeshes(engine, meshes, bondLength * ROTOR_DISPLAY_UNITS_PER_ANGSTROM / 2, object, vector, 0.5, scale)
      meshes.atomsA.getMatrixAt(0, matrix)
      const a = new THREE.Vector3().setFromMatrixPosition(matrix)
      const displayedRadius = geometry.parameters.radius * new THREE.Vector3().setFromMatrixScale(matrix).x
      meshes.atomsB.getMatrixAt(0, matrix)
      const b = new THREE.Vector3().setFromMatrixPosition(matrix)
      expect(displayedRadius / a.distanceTo(b) * bondLength * 100).toBeCloseTo(radius, 5)
    }
    Object.values(meshes).forEach(mesh => mesh.dispose()); geometry.dispose(); material.dispose()
  })

  it.each([0, -1, Infinity, NaN])('rejects invalid second mass %s', mass2 => {
    expect(() => molecularParameters(1, 0.74, mass2)).toThrow(RangeError)
  })
})
