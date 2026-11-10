import { ELECTRON_VOLT, HBAR, quantumQuantities } from '../physics/quantum'
import { getMolecularParameters } from '../physics/molecule'
import type { Settings } from '../types'
import { MathText, Scientific } from './UI'
import type { QuantumTimeline } from '../physics/evolution'
import { useQuantumFrame } from './CoherentTransition'
import { densityMoments } from '../physics/superposition'

function EnergyLadder({ j, secondJ }: { j: number; secondJ?: number }) {
  const highLevels = [...new Set(secondJ === undefined ? [j] : [j, secondJ])].filter(level => level > 3).sort((a, b) => b - a)
  const scale = 12, breakGap = 64, padding = 16
  const lowTop = padding + highLevels.length * breakGap
  const height = lowTop + 12 * scale + padding
  const levels = [
    ...highLevels.map((level, i) => ({ j: level, y: padding + i * breakGap })),
    ...[3, 2, 1, 0].map(level => ({ j: level, y: lowTop + (12 - level * (level + 1)) * scale })),
  ]
  return <section className="energy-ladder" aria-label="Quantized energy ladder">
    <div className="card-eyebrow">QUANTIZED ENERGY LADDER</div>
    <div className="ladder" style={{ height }}>
      {levels.map(level => <div key={level.j} data-j={level.j} className={j === level.j || secondJ === level.j ? 'current' : ''} style={{ top: level.y }}><span>J = {level.j}</span><i /><small>{level.j * (level.j + 1)} B</small></div>)}
      {highLevels.map((level, i) => <span key={level} className="ladder-break" aria-label="Energy scale break" style={{ top: padding + (i + 0.5) * breakGap }}>...</span>)}
    </div>
  </section>
}

export function PhysicsPanel({ settings: s, timeline }: { settings: Settings; timeline?: QuantumTimeline }) {
  const frame = useQuantumFrame(s.coherentTransition ? timeline : undefined)
  const paired = s.superposition || s.coherentTransition
  const populations = s.coherentTransition ? frame?.coefficients ? densityMoments(frame.coefficients) : { first: 1, second: 0 } : paired ? { first: 0.5, second: 0.5 } : { first: 1, second: 0 }
  const { inertia } = getMolecularParameters(s)
  const q = quantumQuantities(s.j, s.m, inertia)
  const second = paired ? quantumQuantities(s.j2, s.m2, inertia) : q
  const energy = populations.first * q.energy + populations.second * second.energy
  const rms = Math.sqrt(populations.first * s.j * (s.j + 1) + populations.second * (paired ? s.j2 * (s.j2 + 1) : s.j * (s.j + 1)))
  const projection = populations.first * s.m + populations.second * (paired ? s.m2 : s.m)
  return <aside className="physics-panel" aria-label="Physics information">
    <section className="physics-values"><div className="card-eyebrow">STATE OBSERVABLES</div>
      <div className="observable-grid">
      <div className="observable"><label>{paired ? 'Mean rotational energy' : 'Rotational energy'}</label><strong data-testid="energy-value" data-value={energy}><Scientific value={energy} unit="J" /></strong><small>{(energy / ELECTRON_VOLT * 1000).toPrecision(3)} meV</small><div className="observable-symbol"><MathText>{paired ? String.raw`\langle E\rangle` : 'E_J'}</MathText></div></div>
      <div className="observable"><label>{paired ? 'RMS angular momentum' : 'Angular momentum'}</label><strong><MathText>{String.raw`${rms.toFixed(3)}\,\hbar`}</MathText></strong><small><Scientific value={rms * HBAR} unit="J s" /></small><div className="observable-symbol"><MathText>{paired ? String.raw`\sqrt{\langle\mathbf{J}^2\rangle}` : String.raw`|\mathbf{J}|`}</MathText></div></div>
      <div className="observable"><label>{paired ? 'Mean z-projection' : 'z-projection'}</label><strong><MathText>{String.raw`${projection.toFixed(3)}\,\hbar`}</MathText></strong><small><Scientific value={projection * HBAR} unit="J s" /></small><div className="observable-symbol"><MathText>{paired ? String.raw`\langle J_z\rangle` : 'J_z'}</MathText></div></div>
      </div>
    </section>
    <EnergyLadder j={s.j} secondJ={paired ? s.j2 : undefined} />
  </aside>
}
