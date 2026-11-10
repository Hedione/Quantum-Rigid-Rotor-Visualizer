import { expect, test } from '@playwright/test'

test('polar marginal chart and joint angular surface remain separate views of the same state', async ({ page }) => {
  await page.goto('/')
  const stage = page.getByRole('region', { name: 'Unified classical and quantum rotor experiment' })
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Solid-angle probability', exact: true }).click()
  await expect(page.getByRole('img', { name: /^Solid-angle integrated polar probability/ })).toBeVisible()
  await page.getByRole('group', { name: 'Radial quantity', exact: true }).getByRole('button', { name: 'Joint angular probability distribution', exact: true }).click()
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('button', { name: 'Color by complex phase', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Explore high J', exact: true }).click()
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('spinbutton', { name: 'J', exact: true }).fill('43')
  await page.getByRole('spinbutton', { name: 'J', exact: true }).press('Enter')
  await page.getByRole('spinbutton', { name: 'mJ', exact: true }).fill('0')
  await page.getByRole('spinbutton', { name: 'mJ', exact: true }).press('Enter')
  await expect(stage).toHaveAttribute('data-displayed-j', '43')
  await expect(stage).toHaveAttribute('data-displayed-m', '0')
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await page.screenshot({ path: 'test-results/solid-angle-probability.png', fullPage: true })
  await expect(page.getByText('3D rendering is unavailable')).toHaveCount(0)
})

test('rapid high-J edits preserve the current scene until the latest worker result is ready', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      postMessage(message: unknown) { setTimeout(() => super.postMessage(message), 600) }
    }
  })
  await page.goto('/')
  const stage = page.getByRole('region', { name: 'Unified classical and quantum rotor experiment' })
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  expect(page.workers().some(worker => worker.url().includes('quantum.worker'))).toBe(true)
  await page.getByRole('button', { name: 'Explore high J', exact: true }).click()
  const startingJ = page.getByRole('spinbutton', { name: 'J', exact: true })
  await expect(startingJ).toHaveValue('1')
  await startingJ.fill('50'); await startingJ.press('Enter')
  await expect(stage).toHaveAttribute('data-displayed-j', '50')
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  const j = page.getByRole('spinbutton', { name: 'J', exact: true })
  const m = page.getByRole('spinbutton', { name: 'mJ', exact: true })
  await j.fill('43'); await j.press('Enter')
  await expect(stage).toHaveAttribute('aria-busy', 'true')
  await expect(stage).toHaveAttribute('data-displayed-j', '50')
  await m.fill('0'); await m.press('Enter')
  await expect(m).toHaveValue('0')
  await expect(page.getByTestId('preparation-status')).toContainText('Updating J = 43, mJ = 0')
  await expect(page.locator('canvas')).toHaveCount(3)
  // Software WebGL plus the intentionally delayed worker can exceed 5 seconds.
  await expect(stage).toHaveAttribute('aria-busy', 'false', { timeout: 15000 })
  await expect(stage).toHaveAttribute('data-displayed-j', '43')
  await expect(stage).toHaveAttribute('data-displayed-m', '0')
  await expect(page.getByTestId('preparation-status')).toBeEmpty()
})
