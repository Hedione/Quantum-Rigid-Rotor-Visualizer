import { expect, test } from '@playwright/test'
import { selectMode, setRotorCount } from './controls'

test('Bloch camera gestures preserve both paused molecular views', async ({ page }) => {
  test.setTimeout(180000)
  await page.goto('/')
  await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  await page.getByRole('button', { name: 'Evolve in time', exact: true }).click()
  await setRotorCount(page, 100)
  await selectMode(page, 'superposition')
  await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('tab', { name: 'Bloch sphere', exact: true }).click()
  await page.addStyleTag({ content: '.pane-label, .pane-note, .pane-phase { visibility: hidden !important; }' })
  await page.evaluate(() => document.fonts.ready)
  const ensemble = page.getByTestId('pane-ensemble').locator('.pane-canvas')
  const surface = page.getByTestId('pane-wavefunction').locator('.pane-canvas')
  const sphere = page.getByTestId('pane-classical').locator('.pane-canvas')
  const before = [await ensemble.screenshot(), await surface.screenshot()]
  const original = await sphere.screenshot()
  const bounds = (await sphere.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 25, { steps: 8 })
  await page.mouse.up()
  await page.mouse.wheel(0, -100)
  expect((await ensemble.screenshot()).equals(before[0])).toBe(true)
  expect((await surface.screenshot()).equals(before[1])).toBe(true)
  expect((await sphere.screenshot()).equals(original)).toBe(false)
})
