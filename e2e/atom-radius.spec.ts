import { expect, test } from '@playwright/test'

declare global { interface Window { atomRadiusPreparations: number } }

test('ensemble atom radius changes while paused without altering the bond, samples, or other views', async ({ page }) => {
  await page.addInitScript(() => {
    window.atomRadiusPreparations = 0
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      postMessage(message: unknown) { window.atomRadiusPreparations++; super.postMessage(message) }
    }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Number of Classical Rotors exact value', exact: true }).fill('50')
  const opacity = page.getByRole('slider', { name: 'Rotor opacity', exact: true })
  await opacity.focus(); await opacity.press('End')
  const radius = page.getByRole('slider', { name: 'Atom radius (visualization only)', exact: true })
  await expect(radius).toHaveValue('5')
  await expect(radius).toHaveAttribute('aria-valuetext', '5pm')
  const canvas = page.getByTestId('scene-ensemble').locator('canvas')
  const surface = page.getByTestId('scene-wavefunction').locator('canvas')
  const original = await canvas.screenshot()
  const originalSurface = await surface.screenshot()
  const total = await page.getByTestId('cumulative-samples').textContent()
  const energy = await page.getByTestId('energy-value').getAttribute('data-value')
  const preparations = await page.evaluate(() => window.atomRadiusPreparations)
  await radius.focus(); await radius.press('End')
  await expect(radius).toHaveAttribute('aria-valuetext', '10pm')
  await expect.poll(async () => (await canvas.screenshot()).equals(original)).toBe(false)
  const occlusion = page.getByRole('button', { name: 'Particle occlusion', exact: true })
  for (let i = 0; i < 2; i++) {
    await occlusion.click()
    await expect(radius).toBeEnabled()
    const large = await canvas.screenshot()
    await radius.focus(); await radius.press('Home')
    await expect(radius).toHaveAttribute('aria-valuetext', '0.5pm')
    await expect.poll(async () => (await canvas.screenshot()).equals(large)).toBe(false)
    await occlusion.click()
    await radius.focus(); await radius.press('End')
  }
  await radius.dblclick()
  await expect(radius).toHaveValue('5')
  await expect.poll(async () => (await canvas.screenshot()).equals(original)).toBe(true)
  expect((await surface.screenshot()).equals(originalSurface)).toBe(true)
  await expect(page.getByTestId('cumulative-samples')).toHaveText(total!)
  await expect(page.getByTestId('energy-value')).toHaveAttribute('data-value', energy!)
  for (const kind of ['ensemble', 'classical', 'wavefunction']) await expect(page.getByTestId(`scene-${kind}`)).toHaveAttribute('data-bond-length', '0.74')
  expect(await page.evaluate(() => window.atomRadiusPreparations)).toBe(preparations)
  await page.getByRole('button', { name: 'Regenerate once', exact: true }).click()
  await expect.poll(async () => (await canvas.screenshot()).equals(original)).toBe(false)
  expect(await canvas.evaluate(canvas => (canvas as HTMLCanvasElement).getContext('webgl2')!.getError())).toBe(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await radius.focus(); await radius.press('End')
  await expect(radius).toHaveValue('10')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByTestId('controls-ensemble').screenshot({ path: 'test-results/atom-radius-controls-mobile.png' })
  await page.getByRole('button', { name: 'RESET SIMULATION', exact: true }).click()
  await expect(radius).toHaveValue('5')
  expect(errors).toEqual([])
})
