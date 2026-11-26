import type { Page } from '@playwright/test'
import { logPosition } from '../src/physics/scales'
import { MAX_ROTORS } from '../src/physics/sampling'

export async function setRotorCount(page: Page, count: number) {
  const slider = page.getByRole('slider', { name: 'Number of Classical Rotors', exact: true })
  await slider.evaluate((element, position) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, String(position))
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, Math.round(logPosition(count, 1, MAX_ROTORS) * 10000))
}

export async function selectMode(page: Page, mode: 'static' | 'superposition' | 'transition') {
  const trigger = page.getByRole('button', { name: 'Simulation mode', exact: true })
  if (!await trigger.isVisible()) await page.getByRole('button', { name: 'SIMULATION SETTINGS', exact: true }).click()
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  await page.getByRole('button', { name: `${mode[0].toUpperCase()}${mode.slice(1)} mode`, exact: true }).click()
}
