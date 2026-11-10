import type { Settings } from '../types'
import type { QuantumTimeline } from '../physics/evolution'
import { dipoleExpectation, drivingFieldAmplitude, electricField, transitionDipole, transitionRates } from '../physics/transition'
import { initialCoefficients } from '../physics/superposition'
import { useQuantumFrame } from './CoherentTransition'
import { SIValue } from './UI'

export function FieldControls({ settings, timeline }: { settings: Settings; timeline: QuantumTimeline }) {
  const frame = useQuantumFrame(timeline), amplitude = drivingFieldAmplitude(settings)
  const angularDipole = transitionDipole(settings)
  const rates = transitionRates(settings)
  const unitField = electricField(settings, rates.resonance, frame?.time ?? 0, settings.drivePhase, angularDipole)
  const field = { x: unitField.x * amplitude, y: unitField.y * amplitude, z: unitField.z * amplitude }
  const dipole = dipoleExpectation(settings, frame?.coefficients ?? initialCoefficients, angularDipole)
  return <section className="inline-scene-controls" aria-label="Electric field and molecular dipole" data-testid="controls-field">
    <h3 className="scene-controls-heading">Field &amp; dipole</h3>
    <div className="scene-controls-body field-readouts" data-testid="field-dipole-readouts" data-time={frame?.time ?? 0} data-ex={field.x} data-ey={field.y} data-ez={field.z} data-mux={dipole.x} data-muy={dipole.y} data-muz={dipole.z}>
      <div><span title="Resonant photon frequency f = |Ef − Ei| / h">Photon frequency</span><strong data-testid="photon-frequency" data-hertz={rates.photonFrequency}><SIValue value={rates.photonFrequency} unit="Hz" /></strong></div>
      <div><span title="Vacuum wavelength λ = c / f">Photon wavelength</span><strong data-testid="photon-wavelength" data-metres={rates.photonWavelength}><SIValue value={rates.photonWavelength} unit="m" /></strong></div>
      <div><span className="field-electric">Electric field |E|</span><strong><SIValue value={Math.hypot(field.x, field.y, field.z)} unit="V/m" /></strong></div>
      <div><span className="field-dipole">Dipole |⟨μ⟩|</span><strong><SIValue value={Math.hypot(dipole.x, dipole.y, dipole.z)} unit="D" /></strong></div>
      <p>The electric-field magnitude is for illustration only and does not represent a realistic experimental field. Typical laboratory fields are much smaller, giving Rabi frequencies too low for intuitive visualization at this time scale.</p>
    </div>
  </section>
}
