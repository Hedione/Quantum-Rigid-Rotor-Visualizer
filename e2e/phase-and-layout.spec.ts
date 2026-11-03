import { expect, test } from '@playwright/test'
import { HBAR, molecularParameters, quantumQuantities } from '../src/physics/quantum'
import { QUANTUM_TIME_SCALE } from '../src/physics/evolution'

declare global { interface Window { phaseLayoutTime: number; phaseLayoutPreparations: number } }

test('single eigenstates evolve in phase while probability remains stationary and real/imaginary colors show sign', async ({ page }) => {
  test.setTimeout(90000)
  await page.addInitScript(() => {
    window.phaseLayoutTime = 10000; window.phaseLayoutPreparations = 0
    performance.now = () => window.phaseLayoutTime
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = callback => raf(() => callback(window.phaseLayoutTime))
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      postMessage(message: unknown) { window.phaseLayoutPreparations++; super.postMessage(message) }
    }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const stage = page.locator('[aria-busy]')
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await expect(stage).toHaveAttribute('data-superposition', 'false')
  await expect(stage).toHaveAttribute('data-evolving', 'true')
  const evolution = page.getByRole('button', { name: 'Evolve in time', exact: true })
  await expect(page.getByTestId('quantum-time')).toBeHidden()
  await expect(page.getByTestId('quantum-time')).toHaveText('')
  await expect(page.locator('.evolution-elapsed')).toHaveCount(0)
  const superposition = page.getByRole('button', { name: 'Superposition mode', exact: true })
  expect((await evolution.boundingBox())!.y).toBeLessThan((await superposition.boundingBox())!.y)
  for (const button of [evolution, page.getByRole('button', { name: 'Enable J > 10', exact: true })]) {
    await expect(button.locator('.toggle-state')).toHaveCount(0)
    await expect(button.locator('.toggle-label')).toHaveCSS('text-align', 'center')
  }
  await expect(page.locator('.pane-label small')).toHaveCount(0)
  for (const name of ['Color by complex phase', 'z axis', 'Synchronize cameras']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.getByText('Scene settings', { exact: true })).toHaveCount(0)
  await superposition.click()
  await expect(page.getByTestId('superposition-controls').getByRole('math')).toHaveCount(0)
  await superposition.click()
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const surface = page.getByTestId('scene-wavefunction').locator('canvas')
  const legend = page.locator('.pane-phase')
  await page.getByRole('button', { name: 'Magnitude', exact: true }).click()
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await expect(legend).toHaveAttribute('data-color-mode', 'phase')
  const original = await surface.screenshot()
  const preparations = await page.evaluate(() => window.phaseLayoutPreparations)
  const advance = async (delta: number) => {
    await page.evaluate(milliseconds => { window.phaseLayoutTime += milliseconds }, delta)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  }
  const { inertia } = molecularParameters(1, .74)
  const quarterPeriod = Math.PI / 2 / (quantumQuantities(1, 0, inertia).energy / HBAR) / QUANTUM_TIME_SCALE * 1000
  await page.getByRole('button', { name: 'Resume sampling', exact: true }).click()
  await advance(quarterPeriod)
  await expect.poll(async () => (await surface.screenshot()).equals(original)).toBe(false)
  expect(await page.evaluate(() => window.phaseLayoutPreparations)).toBe(preparations)
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const time = page.getByTestId('quantum-time'), frozen = await time.getAttribute('data-time')
  const paused = await surface.screenshot()
  await advance(2000)
  await expect(time).toHaveAttribute('data-time', frozen!)
  expect((await surface.screenshot()).equals(paused)).toBe(true)
  await page.getByRole('button', { name: 'Probability density', exact: true }).click()
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await expect(legend).toHaveAttribute('data-color-mode', 'density')
  await expect(legend).not.toContainText('phase')
  const density = await surface.screenshot()
  await page.getByRole('button', { name: 'Resume sampling', exact: true }).click()
  await advance(1000)
  expect((await surface.screenshot()).equals(density)).toBe(true)
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  for (const name of ['Real component', 'Imaginary component']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(stage).toHaveAttribute('aria-busy', 'false')
    await expect(legend).toHaveAttribute('data-color-mode', 'sign')
    await expect(legend).toContainText('positive / negative')
    await expect(legend).not.toContainText('phase')
  }
  await expect(page.getByTestId('controls-wavefunction').locator('.control-note')).toHaveCount(0)
  await evolution.click()
  await expect(page.getByRole('slider', { name: 'Evolution playback speed', exact: true })).toBeDisabled()
  await expect(time).toHaveCount(0)
  await expect(page.locator('.zero-component')).toBeVisible()
  const j = page.getByRole('spinbutton', { name: 'J', exact: true })
  await j.fill('0'); await j.press('Enter')
  await expect(stage).toHaveAttribute('data-displayed-j', '0')
  await evolution.click()
  await expect(page.locator('.zero-component')).toBeVisible()
  expect(errors).toEqual([])
})

test('wider settings and compact ensemble controls fit without wrapping or resizing sampling transport', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
  const controls = page.getByTestId('controls-ensemble')
  for (const width of [1920, 1440, 1280, 1101, 1100, 760, 720, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    if (width > 760) expect((await page.locator('.sidebar-shell').boundingBox())!.width).toBe(width > 1100 ? 399 : 372)
    if (width > 760) {
      const navigation = page.locator('.state-navigation')
      const row = await navigation.boundingBox(), highJ = await navigation.getByRole('button', { name: 'Enable J > 10', exact: true }).boundingBox()
      const previous = await navigation.getByRole('button', { name: 'Previous', exact: true }).boundingBox(), next = await navigation.getByRole('button', { name: 'Next', exact: true }).boundingBox()
      const formerWidth = row!.width - previous!.width - next!.width - 10
      expect(highJ!.width / formerWidth).toBeGreaterThan(.42)
      expect(highJ!.width / formerWidth).toBeLessThan(.58)
      expect(Math.abs(highJ!.x + highJ!.width / 2 - row!.x - row!.width / 2)).toBeLessThan(1)
    }
    await controls.scrollIntoViewIfNeeded()
    const pause = controls.getByRole('button', { name: 'Pause sampling', exact: true })
    const original = await pause.boundingBox()
    await pause.click()
    const resume = controls.getByRole('button', { name: 'Resume sampling', exact: true })
    const paused = await resume.boundingBox()
    expect(paused!.width).toBe(original!.width); expect(paused!.height).toBe(original!.height)
    const heading = controls.locator('.ensemble-controls-heading')
    expect(await heading.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    const footer = controls.locator('.ensemble-footer-controls')
    expect(await footer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    const palettes = await footer.locator('.rotor-palette button').first().boundingBox()
    expect(palettes).not.toBeNull()
    const boxes = await footer.locator('.rotor-palette button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().y))
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(1)
    for (const name of ['Green / violet', 'Blue / orange', 'Single mint']) {
      const label = controls.getByRole('button', { name, exact: true }).locator('span')
      await expect(label).toBeVisible(); await expect(label).toHaveText(name)
      expect(await label.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
    for (const row of await controls.locator('.control-label, .range-bounds').all()) expect(await row.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    for (const label of await controls.locator('.control-label > span').all()) expect(await label.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    const sampling = await controls.getByRole('slider', { name: 'Sampling frequency', exact: true }).locator('..').boundingBox()
    const radius = await controls.getByRole('slider', { name: 'Atom radius (visualization only)', exact: true }).locator('..').boundingBox()
    expect(Math.abs(sampling!.y - radius!.y)).toBeLessThan(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await resume.click()
  }
  await controls.getByRole('button', { name: 'Blue / orange', exact: true }).click()
  await expect(page.getByTestId('scene-ensemble')).toHaveAttribute('data-rotor-palette', 'blueOrange')
  await controls.screenshot({ path: 'test-results/compact-ensemble-mobile.png' })
  expect(errors).toEqual([])
})
