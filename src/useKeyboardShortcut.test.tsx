// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useKeyboardShortcut } from './useKeyboardShortcut'

afterEach(cleanup)

it('uses the current action, accepts uppercase keys, and removes disabled shortcuts', () => {
  const first = vi.fn(), second = vi.fn()
  const { rerender, unmount } = renderHook(({ action, enabled }) => useKeyboardShortcut('r', action, enabled), { initialProps: { action: first, enabled: true } })
  fireEvent.keyDown(window, { key: 'R' })
  expect(first).toHaveBeenCalledTimes(1)
  rerender({ action: second, enabled: true })
  fireEvent.keyDown(window, { key: 'r' })
  expect(second).toHaveBeenCalledTimes(1)
  expect(first).toHaveBeenCalledTimes(1)
  rerender({ action: second, enabled: false })
  fireEvent.keyDown(window, { key: 'r' })
  unmount()
  fireEvent.keyDown(window, { key: 'r' })
  expect(second).toHaveBeenCalledTimes(1)
})

it.each(['repeat', 'isComposing', 'ctrlKey', 'altKey', 'metaKey'] as const)('ignores %s events and preserves their defaults', flag => {
  const action = vi.fn()
  renderHook(() => useKeyboardShortcut('w', action))
  const event = new KeyboardEvent('keydown', { key: 'w', [flag]: true, cancelable: true })
  window.dispatchEvent(event)
  expect(action).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
})

it('ignores consumed events, editable fields, and open dialogs', () => {
  const action = vi.fn()
  render(<><input /><textarea /><select /><div contentEditable><span>Editable text</span></div><div role="textbox" tabIndex={0} /><dialog open><button>Dialog control</button></dialog></>)
  renderHook(() => useKeyboardShortcut('r', action))
  fireEvent.keyDown(window, { key: 'r' })
  document.querySelector('dialog')!.removeAttribute('open')
  for (const field of document.querySelectorAll('input, textarea, select, [contenteditable] span, [role="textbox"]')) fireEvent.keyDown(field, { key: 'r' })
  const consumed = new KeyboardEvent('keydown', { key: 'r', cancelable: true })
  consumed.preventDefault()
  window.dispatchEvent(consumed)
  expect(action).not.toHaveBeenCalled()
  fireEvent.keyDown(document.body, { key: 'r' })
  expect(action).toHaveBeenCalledTimes(1)
})

it('Space overrides focused buttons and consumes held-key repeats without toggling again', () => {
  const action = vi.fn()
  render(<button>Control</button>)
  renderHook(() => useKeyboardShortcut(' ', action))
  const button = screen.getByRole('button')
  const press = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true })
  button.dispatchEvent(press)
  expect(action).toHaveBeenCalledTimes(1)
  expect(press.defaultPrevented).toBe(true)
  const repeat = new KeyboardEvent('keydown', { key: ' ', repeat: true, cancelable: true, bubbles: true })
  button.dispatchEvent(repeat)
  expect(action).toHaveBeenCalledTimes(1)
  expect(repeat.defaultPrevented).toBe(true)
  const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true })
  document.body.dispatchEvent(event)
  expect(action).toHaveBeenCalledTimes(2)
  expect(event.defaultPrevented).toBe(true)
})

it('preserves normal Space behavior in editable fields and open dialogs', () => {
  const action = vi.fn()
  render(<><input /><dialog open><button>Close</button></dialog></>)
  renderHook(() => useKeyboardShortcut(' ', action))
  for (const target of [screen.getByRole('textbox'), screen.getByRole('button')]) {
    const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true })
    target.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  }
  document.querySelector('dialog')!.removeAttribute('open')
  fireEvent.keyDown(screen.getByRole('textbox'), { key: ' ' })
  expect(action).not.toHaveBeenCalled()
})

it('Space handles a focused range input without scrolling or changing its value', () => {
  const action = vi.fn()
  render(<input type="range" min="1" max="60" defaultValue="15" />)
  renderHook(() => useKeyboardShortcut(' ', action))
  const slider = screen.getByRole('slider') as HTMLInputElement
  slider.focus()
  const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true })
  slider.dispatchEvent(event)
  expect(action).toHaveBeenCalledTimes(1)
  expect(event.defaultPrevented).toBe(true)
  expect(slider.value).toBe('15')
  const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true })
  slider.dispatchEvent(arrow)
  expect(arrow.defaultPrevented).toBe(false)
  expect(action).toHaveBeenCalledTimes(1)
})
