# Hedione's Rigid Rotor Visualizer

**[Open the interactive visualizer in your browser →](https://hedione.github.io/Quantum-Rigid-Rotor-Visualizer/)**

An interactive laboratory for exploring molecular rotation, quantum probability, and interference. Compare an energy-matched classical rotor, a sampled quantum ensemble, and the quantum wavefunction in three connected 3D views.

The visualizer runs in the browser and includes controls for individual eigenstates, two-state superpositions, time evolution, and orientation statistics.

## Three connected views

- **Classical motion:** A rotating diatomic molecule with the energy and angular momentum components of the selected quantum state. Superposition mode displays one classical comparison for each component state.
- **Quantum probability ensemble:** Up to 10,000 independently sampled molecular orientations, drawn from the quantum probability distribution. The central view makes the distribution visible as a cloud of rigid rotors.
- **Wavefunction & probability:** A radial surface showing magnitude, probability density, joint angular probability, real component, or imaginary component. Complex phase coloring and eigenstate nodal structures help reveal the spherical harmonics.

Drag to orbit and scroll or pinch to zoom. Cameras can move together or independently, and each view has its own controls directly underneath it. The layout adapts to smaller screens.

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

The ensemble and surface use the same quantum clock. Different energies can produce a changing interference pattern. Equal-energy superpositions retain a stationary probability distribution while their overall complex phase evolves. Time evolution is on by default when you enable superposition. Evolution speed ranges from **0.01× to 100×**, with **1×** as the default. The slider shows physical femtoseconds per on-screen second: **20 fs/s** at 1×. Its companion toggle disables and grays out the slider when off. The quantum display clock is five times slower than the classical clock to make interference easier to follow. Pausing ensemble sampling also freezes quantum evolution.

## Probability surfaces and orientation distributions

The default radial surface is the **joint angular probability distribution**:

```text
p(θ, φ) = |ψ(θ, φ)|² sin θ
```

This is probability density per dθ dφ. Both angles remain visible, preserving interference without integrating over azimuth. Other surface choices display |ψ|, |ψ|², Re(ψ), or Im(ψ). Surface radii are normalized for readability; they are not molecular bond lengths or trajectories. Real and imaginary components depend on the phase convention.

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
| Particle mass | 1 u for both | 0.1–200 u; independent second mass in asymmetric mode |
| Bond length | 0.74 Å | 0.2–3 Å, slider and exact input |
| Asymmetric bond | Off | Unequal masses rotate about their center of mass |
| Rotor colors | Green / violet | Also cyan / coral or single mint |
| Particle occlusion | Off | Enable to hide particles behind nearer surfaces |
| Superposition / time evolution | Off / On | Evolution starts when superposition is enabled |

Double-click a slider to restore its default. Sampling frequency controls new orientation batches, independently of the rendering frame rate. Histogram collection records available batches at its selected rate; it does not duplicate samples when it runs faster than the ensemble.

## Physics and interpretation

The default molecule is an idealized hydrogen rigid rotor with **1 u per atom** and a **0.74 Å** bond length. **Particles & bond** lets you change the shared mass and bond length, or enable **Asymmetric bond** to set each mass independently. The reduced mass is μ = m₁m₂/(m₁ + m₂), and the moment of inertia is I = μr². The heavier particle sits closer to the center of mass. At each selected bond length, both rotor views preserve the separation and rotate about that center.

Choose **H₂, HD, N₂, or CO** to apply a rounded molecular model, then adjust its masses and bond length freely. Preset bond lengths use rounded [NIST CCCBDB experimental values](https://cccbdb.nist.gov/bondlengthmodel2x.asp?basis=25&method=63); masses are simplified educational values. Changing the bond length updates the geometry in both rotor views, the display scale of the wavefunction/probability surface, the energies, and both physical clocks. Cameras keep larger molecules in view. The normalized angular wavefunction itself remains independent of molecular size.

The ensemble offers green/violet, cyan/coral, and single-mint color presets. The **Occlusion** switch sits beside rotor opacity. With it off, overlapping particles remain visible and their colors accumulate. Turning it on sets opacity to **100%** and disables the opacity slider while nearer particle surfaces hide those behind them. Turning it off restores the previously selected opacity. The wavefunction retains its separate opaque surface rendering.

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
