import { DISPLAY_TIME_SCALE } from './classical'
import { HBAR, quantumQuantities } from './quantum'
import { getMolecularParameters, type MolecularSettings } from './molecule'
import type { Settings } from '../types'

/** Quantum interference is five times slower than the classical display clock at nominal 1×. */
export const QUANTUM_TIME_SCALE = DISPLAY_TIME_SCALE / 5
type EvolutionSettings = Pick<Settings, 'j' | 'm' | 'j2' | 'm2' | 'superposition' | 'timeEvolution' | 'ensemblePaused' | 'quantumPlayback'> & MolecularSettings
export interface QuantumFrame { time: number; firstPhase: number; secondPhase: number; relativePhase: number; enabled: boolean }

/** One analytic clock for separate canvases; changing playback preserves phase. */
export class QuantumTimeline {
  private key = ''
  private anchor = 0
  private time = 0
  private speed = 0
  private firstRate = 0
  private secondRate = 0
  enabled = false
  frame: QuantumFrame = { time: 0, firstPhase: 0, secondPhase: 0, relativePhase: 0, enabled: false }

  configure(s: EvolutionSettings, now: number) {
    const previous = this.read(now).time
    const enabled = s.superposition && s.timeEvolution
    const { inertia, mass1, mass2 } = getMolecularParameters(s)
    const key = JSON.stringify([s.j, s.m, s.j2, s.m2, s.superposition, enabled, mass1, mass2, s.bondLength])
    this.time = key === this.key ? previous : 0
    this.key = key; this.anchor = now; this.enabled = enabled
    this.speed = enabled && !s.ensemblePaused ? QUANTUM_TIME_SCALE * s.quantumPlayback / 1000 : 0
    this.firstRate = quantumQuantities(s.j, s.m, inertia).energy / HBAR
    this.secondRate = quantumQuantities(s.j2, s.m2, inertia).energy / HBAR
    this.frame = this.read(now)
  }

  tick(now: number) { this.frame = this.read(now) }

  read(now: number): QuantumFrame {
    const time = this.enabled ? this.time + Math.max(0, now - this.anchor) * this.speed : 0
    const firstPhase = (this.firstRate * time) % (2 * Math.PI)
    const secondPhase = (this.secondRate * time) % (2 * Math.PI)
    return { time, firstPhase, secondPhase, relativePhase: firstPhase - secondPhase, enabled: this.enabled }
  }
}
