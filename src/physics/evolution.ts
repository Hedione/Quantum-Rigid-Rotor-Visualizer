import { DISPLAY_TIME_SCALE } from './classical'
import { HBAR, quantumQuantities } from './quantum'
import { getMolecularParameters, type MolecularSettings } from './molecule'
import type { Settings } from '../types'
import { equalCoefficients, initialCoefficients, normalizeCoefficients, type WaveCoefficients } from './superposition'
import { laboratoryCoefficients, rabiCoefficients, transitionTimeScale, validateTransition } from './transition'

/** Quantum interference is five times slower than the classical display clock at nominal 1×. */
export const QUANTUM_TIME_SCALE = DISPLAY_TIME_SCALE / 5
type EvolutionSettings = Pick<Settings, 'j' | 'm' | 'j2' | 'm2' | 'superposition' | 'timeEvolution' | 'ensemblePaused' | 'quantumPlayback'> & MolecularSettings & Partial<Settings>
export interface QuantumFrame { time: number; firstPhase: number; secondPhase: number; relativePhase: number; enabled: boolean; coefficients?: WaveCoefficients; progress?: number }

/** One analytic clock for separate canvases; changing playback preserves phase. */
export class QuantumTimeline {
  private key = ''
  private anchor = 0
  private time = 0
  private speed = 0
  private firstRate = 0
  private secondRate = 0
  private transition?: { omega: number; phase: number; allowed: boolean; loop: boolean }
  private seekKey = ''
  private weights = initialCoefficients
  enabled = false
  frame: QuantumFrame = { time: 0, firstPhase: 0, secondPhase: 0, relativePhase: 0, enabled: false }

  configure(s: EvolutionSettings, now: number) {
    const previous = this.read(now).time
    const coherent = s.coherentTransition ?? false
    const enabled = coherent || s.timeEvolution
    const { inertia, mass1, mass2 } = getMolecularParameters(s)
    const paired = s.superposition || coherent
    const key = JSON.stringify([s.j, s.m, paired ? s.j2 : 0, paired ? s.m2 : 0, paired, coherent, enabled, mass1, mass2, s.bondLength, coherent ? s.rabiFrequency : 0, coherent ? s.polarization : '', coherent ? s.dipoleMoment : 0, coherent && !!s.transitionLoop])
    const unchanged = key === this.key
    this.time = unchanged ? previous : 0
    this.key = key; this.anchor = now; this.enabled = enabled
    this.transition = coherent ? { omega: s.rabiFrequency! * 1e12, phase: s.drivePhase!, allowed: validateTransition(s as Settings).allowed, loop: s.transitionLoop ?? false } : undefined
    this.weights = paired ? normalizeCoefficients(equalCoefficients, s.j === s.j2 && s.m === s.m2) : initialCoefficients
    if (coherent) {
      const seekKey = JSON.stringify([s.transitionProgress, s.transitionRun])
      if (seekKey !== this.seekKey && unchanged) this.time = s.transitionProgress! * (this.transition!.loop ? 2 : 1) * Math.PI / this.transition!.omega
      this.seekKey = seekKey
      if (!this.transition!.allowed) this.time = 0
    } else this.seekKey = ''
    this.speed = enabled && !s.ensemblePaused ? (coherent ? s.transitionPlaying && this.transition!.allowed ? transitionTimeScale(s as Settings) : 0 : QUANTUM_TIME_SCALE * s.quantumPlayback) / 1000 : 0
    this.firstRate = quantumQuantities(s.j, s.m, inertia).energy / HBAR
    this.secondRate = paired ? quantumQuantities(s.j2, s.m2, inertia).energy / HBAR : this.firstRate
    this.frame = this.read(now)
  }

  tick(now: number) { this.frame = this.read(now) }

  read(now: number): QuantumFrame {
    const elapsed = this.enabled ? this.time + Math.max(0, now - this.anchor) * this.speed : 0
    const time = this.transition && !this.transition.loop ? Math.min(elapsed, Math.PI / this.transition.omega) : elapsed
    const firstPhase = (this.firstRate * time) % (2 * Math.PI)
    const secondPhase = (this.secondRate * time) % (2 * Math.PI)
    const weights = this.transition ? this.transition.allowed ? rabiCoefficients(time, this.transition.omega, this.transition.phase, this.transition.loop) : initialCoefficients : this.weights
    return { time, firstPhase, secondPhase, relativePhase: firstPhase - secondPhase, enabled: this.enabled,
      coefficients: laboratoryCoefficients(weights, firstPhase, secondPhase), progress: this.transition ? this.transition.loop ? (time * this.transition.omega / (2 * Math.PI)) % 1 : time >= Math.PI / this.transition.omega ? 1 : time * this.transition.omega / Math.PI : undefined }
  }
}
