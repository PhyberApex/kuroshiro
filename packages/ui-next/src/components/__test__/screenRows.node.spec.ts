import { describe, expect, it } from 'vitest'
import { droppedAt, isPassedOver, movedBy, sameOrder } from '../screenRows'

const ORDER = ['calendar', 'weather', 'weekend', 'trains']

describe('moving a row by places', () => {
  it('moves it one place later or earlier', () => {
    expect(movedBy(ORDER, 'weather', 1)).toEqual(['calendar', 'weekend', 'weather', 'trains'])
    expect(movedBy(ORDER, 'weather', -1)).toEqual(['weather', 'calendar', 'weekend', 'trains'])
  })

  it('stays inside the list', () => {
    expect(movedBy(ORDER, 'calendar', -1)).toEqual(ORDER)
    expect(movedBy(ORDER, 'trains', 1)).toEqual(ORDER)
    expect(movedBy(ORDER, 'weather', 9)).toEqual(['calendar', 'weekend', 'trains', 'weather'])
  })
})

describe('dropping a row on the edge of another', () => {
  it('lands before or after the row it is dropped on', () => {
    expect(droppedAt(ORDER, 'calendar', 'trains', 'before')).toEqual(['weather', 'weekend', 'calendar', 'trains'])
    expect(droppedAt(ORDER, 'calendar', 'trains', 'after')).toEqual(['weather', 'weekend', 'trains', 'calendar'])
    expect(droppedAt(ORDER, 'trains', 'calendar', 'before')).toEqual(['trains', 'calendar', 'weather', 'weekend'])
  })

  it('changes nothing when the place is the one it already has', () => {
    expect(droppedAt(ORDER, 'weather', 'weather', 'after')).toEqual(ORDER)
    expect(droppedAt(ORDER, 'weather', 'calendar', 'after')).toEqual(ORDER)
    expect(droppedAt(ORDER, 'weather', 'weekend', 'before')).toEqual(ORDER)
  })
})

describe('comparing two orders', () => {
  it('tells the same order from another', () => {
    expect(sameOrder(ORDER, [...ORDER])).toBe(true)
    expect(sameOrder(ORDER, ['weather', 'calendar', 'weekend', 'trains'])).toBe(false)
    expect(sameOrder(ORDER, ORDER.slice(1))).toBe(false)
  })
})

describe('the Screen States Rotation passes over', () => {
  it('is every state but Active Screen and Up next', () => {
    expect((['scheduleOff', 'notToday', 'notThisHour', 'skipping'] as const).map(isPassedOver)).toEqual([true, true, true, true])
    expect([isPassedOver('active'), isPassedOver('upNext'), isPassedOver(null)]).toEqual([false, false, false])
  })
})
