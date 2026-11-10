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
