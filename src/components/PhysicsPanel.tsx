import { Sparkles } from 'lucide-react'
import { ELECTRON_VOLT, HBAR, molecularParameters, quantumQuantities } from '../physics/quantum'
import type { Settings } from '../types'
import { MathText, Scientific } from './UI'

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
    <p><MathText>{String.raw`B = \hbar^2/(2I)`}</MathText> · {highLevels.length ? 'Energy scale breaks at ...; J = 0–3 spacing is to scale.' : 'Energy spacing to scale: Eⱼ = B J(J + 1).'}</p>
  </section>
}

export function PhysicsPanel({ settings: s }: { settings: Settings }) {
  const { inertia, reducedMass } = molecularParameters(s.atomMass, s.bondLength)
  const q = quantumQuantities(s.j, s.m, inertia)
  const second = s.superposition ? quantumQuantities(s.j2, s.m2, inertia) : q
  const energy = (q.energy + second.energy) / 2
  const rms = Math.sqrt((s.j * (s.j + 1) + (s.superposition ? s.j2 * (s.j2 + 1) : s.j * (s.j + 1))) / 2)
  const projection = (s.m + (s.superposition ? s.m2 : s.m)) / 2
  const duplicate = s.j === s.j2 && s.m === s.m2
  const expression = s.timeEvolution && s.superposition ? duplicate ? String.raw`\psi(t)=Y_{${s.j}}^{${s.m}}e^{-iE_Jt/\hbar}` : String.raw`\psi(t)=\frac{Y_1e^{-iE_1t/\hbar}+Y_2e^{-iE_2t/\hbar}}{\sqrt{2}}` : s.superposition && !duplicate ? String.raw`\psi=\frac{Y_{${s.j}}^{${s.m}}+Y_{${s.j2}}^{${s.m2}}}{\sqrt{2}}` : String.raw`Y_{${s.j}}^{${s.m}}(\theta,\phi)`
  return <aside className="physics-panel" aria-label="Physics information">
    <section className={`eigenstate-card${s.superposition ? ' superposition-state' : ''}`}><div className="card-eyebrow"><Sparkles size={13} /> {s.superposition ? 'COHERENT SUPERPOSITION' : 'SELECTED EIGENSTATE'}</div><div className={`state-expression${s.timeEvolution && s.superposition ? ' evolving-expression' : ''}`}><MathText>{expression}</MathText></div><div className="state-quantum-numbers">{s.superposition ? <><span>State 1 <b>({s.j}, {s.m})</b></span><span>State 2 <b>({s.j2}, {s.m2})</b></span></> : <><span>J <b>{s.j}</b></span><span>m<sub>J</sub> <b>{s.m > 0 ? '+' : ''}{s.m}</b></span></>}</div><div className="stationary-label"><i /> {s.superposition && s.timeEvolution && s.j !== s.j2 ? 'Evolving probability density' : s.superposition && s.j !== s.j2 ? 'Quantum snapshot · t = 0' : 'Stationary probability density'}</div></section>
    <section className="physics-values"><div className="card-eyebrow">STATE OBSERVABLES</div>
      <div className="observable"><label><span>{s.superposition ? 'Mean rotational energy' : 'Rotational energy'}</span><MathText>{s.superposition ? String.raw`\langle E\rangle` : 'E_J'}</MathText></label><strong data-testid="energy-value" data-value={energy}><Scientific value={energy} unit="J" /></strong><small>{(energy / ELECTRON_VOLT * 1000).toPrecision(3)} meV</small></div>
      <div className="observable"><label><span>{s.superposition ? 'RMS angular momentum' : 'Angular momentum'}</span><MathText>{s.superposition ? String.raw`\sqrt{\langle\mathbf{J}^2\rangle}` : String.raw`|\mathbf{J}|`}</MathText></label><strong><MathText>{String.raw`${rms.toFixed(3)}\,\hbar`}</MathText></strong><small><Scientific value={rms * HBAR} unit="J s" /></small></div>
      <div className="observable"><label><span>{s.superposition ? 'Mean z-projection' : 'z-projection'}</span><MathText>{s.superposition ? String.raw`\langle J_z\rangle` : 'J_z'}</MathText></label><strong><MathText>{String.raw`${projection}\,\hbar`}</MathText></strong><small><Scientific value={projection * HBAR} unit="J s" /></small></div>
    </section>
    <EnergyLadder j={s.j} secondJ={s.superposition ? s.j2 : undefined} />
    <details className="constants"><summary>Constants & molecular model</summary><p>ℏ = {HBAR} J s<br />Atom mass = {s.atomMass} u<br />Reduced mass = <Scientific value={reducedMass} unit="kg" /><br />Bond length = {s.bondLength} Å<br />I = <Scientific value={inertia} unit="kg m²" /></p></details>
  </aside>
}
