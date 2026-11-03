# Hedione's Rigid Rotor Visualizer

**[Open the interactive visualizer in your browser →](https://hedione.github.io/Quantum-Rigid-Rotor-Visualizer/)**

An interactive laboratory for exploring molecular rotation, quantum probability, and interference. Compare an energy-matched classical rotor, a sampled quantum ensemble, and the quantum wavefunction in three connected 3D views.

The visualizer runs in the browser and includes controls for individual eigenstates, two-state superpositions, time evolution, and orientation statistics.

## Three connected views

- **Classical motion:** A rotating diatomic molecule with the energy and angular momentum components of the selected quantum state. Superposition mode displays one classical comparison for each component state.
- **Quantum probability ensemble:** Up to 10,000 independently sampled molecular orientations, drawn from the quantum probability distribution. The central view makes the distribution visible as a cloud of rigid rotors.
- **Wavefunction & probability:** A radial surface showing magnitude, probability density, joint angular probability, real component, or imaginary component, with a quantity-specific color legend and optional eigenstate nodal structures.

Drag to orbit and scroll or pinch to zoom. Cameras stay synchronized and the z axis stays visible. Each view has its own controls directly underneath it, and the layout adapts to smaller screens.

## Explore quantum states

Select integer quantum numbers **J** and **m<sub>J</sub>**, with **−J ≤ m<sub>J</sub> ≤ J**, using number fields or sliders. The standard range is J = 0–10. **Enable J > 10**, between Previous and Next, extends the range to 50 and starts at J = 50, m<sub>J</sub> = 50. Turning it off restores the primary and secondary quantum-number selections from before high-J mode was enabled.

J and m<sub>J</sub> remain independently editable. Stretched states with m<sub>J</sub> = J concentrate the ensemble near the classical rotation plane as J increases. Different m<sub>J</sub> values produce different distributions, so increasing J alone does not imply concentration along a particular axis.

## Superposition and interference

**Superposition mode** adds a second independently controlled state. Distinct states are combined coherently with equal amplitudes and zero initial relative phase:

```text
ψ(θ, φ, 0) = [Y₁(θ, φ) + Y₂(θ, φ)] / √2
```

Identical selections normalize to a single eigenstate. Both the surface and the sampled ensemble include interference between the amplitudes. Combining different m<sub>J</sub> values can break azimuthal symmetry.

Try these examples:

| First state (J, m<sub>J</sub>) | Second state | What to explore |
| --- | --- | --- |
| (1, +1) | (1, −1) | A two-lobe pattern with azimuthal structure |
| (2, +2) | (2, −2) | A four-lobe pattern around the z axis |
| (1, 0) | (2, +1) | Interference between different energies; evolves in time by default |

The two-lobe and four-lobe examples have dedicated buttons. **Randomize both states** chooses another pair within the active quantum-number range.

Enable **Evolve in time** to apply each state's energy-dependent phase:

```text
ψ(θ, φ, t) = [Y₁ exp(−iE₁t/ℏ) + Y₂ exp(−iE₂t/ℏ)] / √2
```

The ensemble and surface use the same quantum clock. Different energies can produce a changing interference pattern. Equal-energy superpositions retain a stationary probability distribution while their overall complex phase evolves. Time evolution is on by default for both eigenstates and superpositions, with its controls above Superposition mode. A single eigenstate's global phase changes its phase coloring and real/imaginary components while its magnitude and probability remain fixed. Evolution speed ranges from **0.01× to 100×**, with **1×** as the default. The slider shows physical femtoseconds per on-screen second: **20 fs/s** at 1×. Its companion toggle disables and grays out the slider when off. The quantum display clock is five times slower than the classical clock to make interference easier to follow. Pausing ensemble sampling also freezes quantum evolution.

## Coherent transitions

Use the orange **Switch to Transition mode** button beside the **01 Quantum state** title to open the coherent-transition controls for an ideal resonant π-pulse. **Switch to Static mode** returns to the single-state and superposition controls. Each mode shows its own controls and shares the complex harmonic evaluator, surface renderer, sampler, and quantum timeline. The first transition is **(1, +1) → (2, 0)** with **σ−** polarization.

```text
ci(t) = cos(Ωt/2), cf(t) = −i exp(iφd) sin(Ωt/2)
ψ(t) = ci(t) exp(−iEit/ℏ) Yi + cf(t) exp(−iEft/ℏ) Yf
Tπ = π/Ω
```

Change initial/final states, select π / σ+ / σ−, adjust effective Ω in rad/ps and drive phase, or scrub a complete pulse. Play, pause/resume, reset, and replay share one analytic clock. The final eigenstate holds at pulse completion. Ω defaults to π rad/ps, giving a 1 ps pulse; transition playback defaults to 10× the nominal 20 fs per display second. Playback slows further when necessary to keep laboratory phases below 8 rad per display second. The displayed physical-time rate reports this limit; no dynamical phase is discarded.

The quantization axis is z. π uses E along z and propagation along +x. Circular fields propagate along +z. Operational σ± labels mean Δm = ±1; for absorption σ+ rotates +x toward +y viewed from +z toward the origin, and σ− reverses. The same operational Δm reverses field rotation for stimulated emission. The field preview includes the carrier phase. Drive phase φd is the phase of the effective interaction-picture coupling Hfi = ℏΩ exp(iφd)/2, including the signed dipole and the sign in −μ·E.

Transition validation integrates the existing signed harmonics against C¹q = √(4π/3) Y¹q, including angular coupling factors, and enforces ΔJ = ±1. A zero matrix element or incompatible polarization disables transfer and scrubbing with an explanation. These angular integrals correspond to [NIST's Gaunt integral](https://dlmf.nist.gov/34.3.E22); the [electric-dipole selection rules](https://farside.ph.utexas.edu/teaching/qm/lectures/node79.html) fix the allowed angular changes.

This is the isolated, exact-resonance rotating-wave model with a permanent dipole, no relaxation, and no decoherence. The dipole is assumed independently of the mass presets; a mass preset does not assert that a real molecule is polar. Ω already includes the coupling strength. Real degenerate rotors may couple additional m states; their multilevel dynamics are outside this two-level model. Instantaneous and cumulative diagnostic curves include both changing populations and complex interference.

## Probability surfaces and orientation distributions

The default radial surface is the **joint angular probability distribution**:

```text
p(θ, φ) = |ψ(θ, φ)|² sin θ
```

This is probability density per dθ dφ. Both angles remain visible, preserving interference without integrating over azimuth. Other surface choices display |ψ|, |ψ|², Re(ψ), or Im(ψ). Surface radii are normalized for readability; they are not molecular bond lengths or trajectories. Real and imaginary components depend on the phase convention.

Normalization applies to the underlying quantum functions, before the visual radius scaling:

```text
ρ(θ,φ,t) = |ψ(θ,φ,t)|²           ∫∫ ρ sin θ dθ dφ = 1
p(θ,φ,t) = ρ(θ,φ,t) sin θ       ∫∫ p dθ dφ = 1
```

Both equalities hold for eigenstates, coherent superpositions, and every time during a driven pulse. The sin θ factor appears exactly once. Magnitude, real part, and imaginary part are amplitude views: their individual areas need not be 1. Their normalization criterion is ∫|ψ|² dΩ = ∫[(Re ψ)² + (Im ψ)²] dΩ = 1. Peak-scaled display radii are separate from probability normalization.

The normalization audit in [src/physics/normalization.test.ts](src/physics/normalization.test.ts) integrates all 40,401 eigenstates supported by the mathematical utilities (J = 0–200; the UI supports up to 50), checks the basis Gram matrix, sweeps a complete pulse at 1,001 times for four drive phases, and checks free evolution, arbitrary complex weights, marginals, sampling, and all histogram resolutions. [e2e/normalization.spec.ts](e2e/normalization.spec.ts) independently integrates densities recovered from the GPU surface, undoing only visual scaling. Local audit reports are generated under ignored test-results.

Magnitude always uses complex phase coloring. Real and imaginary components use positive/negative sign colors. Probability and joint density use a single color because densities have no complex phase. The legend follows the selected quantity.

Two histograms compare sampled orientations with theory:

- **Polar:** Choose density versus cos θ or the polar-angle marginal including the solid-angle factor sin θ.
- **Azimuthal:** Inspect the distribution of φ, which is uniform for an individual eigenstate and can vary in a superposition.

The polar chart integrates over φ to form a marginal distribution. This operation is valid even when the full distribution lacks azimuthal symmetry; the azimuthal chart and joint surface retain additional information.

Switch between the **current batch** and **cumulative** statistics, or reset the recorded history. Histogram resolution ranges from **10 to 320 bins**, with **40** as the default. A separate histogram sampling-rate slider lets you reduce statistics collection independently of ensemble redraws. Increasing the bin count does not discard the recorded history.

## Controls and defaults

| Control | Default | Available range |
| --- | --- | --- |
| Initial state | J = 1, m<sub>J</sub> = 0 | J = 0–10; up to 50 in high-J mode |
| Ensemble size | 2,500 rotors | 1–10,000, logarithmic slider |
| Rotor opacity | 1% | 0.5–75%, logarithmic slider; fixed at 100% with occlusion |
| Atom radius (visualization only) | 5 pm | 0.5–10 pm; visualization size rather than an exact measured atomic radius |
| Ensemble sampling frequency | 30 Hz | 1–60 Hz |
| Histogram sampling rate | 10 Hz | 1–60 Hz |
| Histogram bins | 40 | 10, 20, 40, 80, 160, 320 |
| Classical playback speed | 1× | 0.01–3×, logarithmic slider |
| Quantum evolution speed | 1× | 0.01–100×, logarithmic slider |
| Particle 1 / Particle 2 mass | 1 u each | 0.1–200 u; both sliders always available |
| Bond length | 0.74 Å | 0.2–3 Å, slider and exact input |
| Match particle 1 | On | Particle 2 follows Particle 1; editing Particle 2 turns matching off |
| Rotor colors | Green / violet | Also blue / orange or single mint |
| Particle occlusion | Off | Enable to hide particles behind nearer surfaces |
| Superposition / time evolution | Off / On | Eigenstates and superpositions both evolve |

Double-click a slider to restore its default. Sampling frequency controls new orientation batches, independently of the rendering frame rate. Histogram collection records available batches at its selected rate; it does not duplicate samples when it runs faster than the ensemble.

## Physics and interpretation

The default molecule is an idealized hydrogen rigid rotor with **1 u per atom** and a **0.74 Å** bond length. **Particles & bond** shows Particle 1 mass, Particle 2 mass, then Bond length. **Match particle 1**, beside the second slider, starts on: Particle 2 follows edits to Particle 1. Editing Particle 2's slider or exact value turns matching off and allows independent masses. Turning matching on copies Particle 1's current mass to Particle 2. Both sliders stay available throughout. The reduced mass is μ = m₁m₂/(m₁ + m₂), and the moment of inertia is I = μr². The heavier particle sits closer to the center of mass. At each selected bond length, both rotor views preserve the separation and rotate about that center.

Choose **H₂, HD, N₂, or CO** to apply a rounded molecular model, then adjust its masses and bond length freely. Preset bond lengths use rounded [NIST CCCBDB experimental values](https://cccbdb.nist.gov/bondlengthmodel2x.asp?basis=25&method=63); masses are simplified educational values. Changing the bond length updates the geometry in both rotor views, the display scale of the wavefunction/probability surface, the energies, and both physical clocks. Cameras keep larger molecules in view. The normalized angular wavefunction itself remains independent of molecular size.

The ensemble offers green/violet, blue/orange, and single-mint color presets. The **Occlusion** switch sits beside rotor opacity. With it off, overlapping particles remain visible and their colors accumulate. Turning it on sets opacity to **100%** and disables the opacity slider while nearer particle surfaces hide those behind them. Turning it off restores the previously selected opacity. The wavefunction retains its separate opaque surface rendering.

```text
E_J = ℏ² J(J+1) / (2I)
|L| = ℏ √[J(J+1)]
L_z = m_J ℏ
ω_classical = (ℏ/I) √[J(J+1)]
```

Classical motion matches each component state's energy and uses a fixed display clock across the entire J range. At 1× classical playback, one displayed second represents 0.1 picoseconds. At 1× quantum evolution, one displayed second represents 20 femtoseconds. Each has its own playback control. J = 0 has no classical rotation or angular momentum direction.

The **quantized energy ladder** shows J = 0, 1, 2, 3 with energy-proportional spacing, plus higher occupied levels separated by scale breaks. **State observables** summarize energy and angular momentum for the selected state or superposition.

Quantum orientations are sampled with respect to solid angle, **dΩ = sin θ dθ dφ**. The ensemble is a collection of independent measurements of bond direction, rather than molecules following quantum trajectories. A bright value of |ψ|² near a pole does not by itself imply that most orientations lie there: probabilities also depend on the solid-angle measure.

The model uses complex spherical harmonics with the Condon–Shortley phase convention. It illustrates rotational orientation and interference in an ideal rigid rotor; it does not model vibration, electronic structure, nuclear-spin statistics, or thermal populations.

## Implementation and validation

Built with React, TypeScript, Three.js, React Three Fiber, and Vite. Quantum state preparation runs in a background worker, while instanced geometry renders the ensemble. Expensive state changes keep the previous scene visible until the new state is ready. Time-dependent surfaces reuse prepared fields, and histogram collection can be reduced to lower computation load.

Numerical tests cover spherical-harmonic normalization, solid-angle sampling, superpositions, time evolution, classical dynamics, histogram statistics, and high-J stability. Browser tests exercise the controls, responsive layout, shared quantum clock, histogram collection, and wavefunction lobe occlusion.

Physics references: [NIST spherical harmonics](https://dlmf.nist.gov/14.30), [NIST Legendre asymptotic expansions](https://dlmf.nist.gov/18.15.iii), and [GSL associated Legendre functions and spherical harmonics](https://www.gnu.org/software/gsl/doc/html/specfunc.html#associated-legendre-polynomials-and-spherical-harmonics).

## License

This project is available under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Third-party dependencies retain their own licenses.
