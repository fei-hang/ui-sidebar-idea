// @vitest-environment jsdom
/** Activity-rail order and selection stay in memory per rail and survive absent ids. */
import { describe, expect, it, vi } from 'vitest'
import { createButtonOrder, orderRail } from '../src/client/rail/button-order.ts'

describe('createButtonOrder', () => {
  it('starts empty with no selected button', () => {
    const order = createButtonOrder()
    expect(order.order.getSnapshot()).toEqual({ top: [], tail: [] })
    expect(order.selected.getSnapshot()).toBeNull()
  })

  it('moves a button before another one on its own rail', () => {
    const order = createButtonOrder()
    order.move('top', 'alpha', null)
    order.move('top', 'beta', null)
    order.move('top', 'gamma', null)
    expect(order.order.getSnapshot().top).toEqual(['alpha', 'beta', 'gamma'])
    order.move('top', 'gamma', 'alpha')
    expect(order.order.getSnapshot().top).toEqual(['gamma', 'alpha', 'beta'])
  })

  it('appends when the anchor is absent and keeps the other rail untouched', () => {
    const order = createButtonOrder()
    order.move('top', 'alpha', null)
    order.move('tail', 'zeta', null)
    order.move('top', 'beta', 'missing')
    expect(order.order.getSnapshot()).toEqual({ top: ['alpha', 'beta'], tail: ['zeta'] })
  })

  it('ignores a move onto itself and an unchanged result', () => {
    const order = createButtonOrder()
    order.move('top', 'alpha', null)
    order.move('top', 'beta', null)
    const listener = vi.fn()
    order.order.subscribe(listener)
    order.move('top', 'alpha', 'alpha')
    order.move('top', 'alpha', 'beta')
    expect(order.order.getSnapshot().top).toEqual(['alpha', 'beta'])
    expect(listener).not.toHaveBeenCalled()
  })

  it('selects a button and clears the selection', () => {
    const order = createButtonOrder()
    const listener = vi.fn()
    order.selected.subscribe(listener)
    order.select('alpha')
    expect(order.selected.getSnapshot()).toBe('alpha')
    order.select('alpha')
    expect(listener).toHaveBeenCalledTimes(1)
    order.select(null)
    expect(order.selected.getSnapshot()).toBeNull()
  })
})

describe('orderRail', () => {
  it('keeps stored ids that are still registered, then appends new ones', () => {
    expect(orderRail(['alpha', 'beta', 'gamma'], ['gamma', 'alpha'])).toEqual(['gamma', 'alpha', 'beta'])
  })

  it('drops stored ids that are no longer registered', () => {
    expect(orderRail(['alpha'], ['gone', 'alpha', 'also-gone'])).toEqual(['alpha'])
  })

  it('follows registration order when nothing is stored', () => {
    expect(orderRail(['beta', 'alpha'], [])).toEqual(['beta', 'alpha'])
  })
})
