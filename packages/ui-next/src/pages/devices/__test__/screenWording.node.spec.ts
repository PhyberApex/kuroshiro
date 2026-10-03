import type { ScreenRead } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { buildSchedule, buildScreen } from '@/testing/fixtures/screens'
import { scheduleSummary } from '../scheduleSummary'
import { screenStateWords, screenWhy } from '../screenWording'

const at = (hours: number, minutes: number) => new Date(2026, 9, 1, hours, minutes).toISOString()
/** Thursday 1 October 2026, 12:10 in Berlin. */
const NOW = new Date('2026-10-01T10:10:00.000Z')
const ASLEEP = { enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback' as const, inWindow: true, endsAt: at(6, 0) }

function kitchen(overrides: Parameters<typeof buildDeviceDetail>[0] = {}) {
  return buildDeviceDetail({
    id: 'kitchen',
    name: 'Kitchen',
    nextPollAt: new Date(NOW.getTime() + 11 * 60_000).toISOString(),
    currentScreen: { kind: 'screen', screenId: 'calendar', name: 'Calendar', imagePath: '/calendar.png', renderedAt: at(7, 31), servedAt: new Date(2026, 9, 1, 7, 42).toISOString(), paused: false, holding: false },
    ...overrides,
  })
}

const SCREENS = [
  buildScreen({ id: 'weather', name: 'Weather' }),
  buildScreen({ id: 'calendar', name: 'Calendar', state: 'active' }),
  buildScreen({ id: 'photo', name: 'Harbour photo', state: 'upNext' }),
  buildScreen({ id: 'trains', name: 'Train departures', state: 'scheduleOff', schedule: buildSchedule({ enabled: false }) }),
  buildScreen({ id: 'notes', name: 'Notes' }),
]

const whyOf = (screen: ScreenRead, device = kitchen(), screens = SCREENS) => screenWhy({ screen, screens, device, now: NOW, timezone: 'Europe/Berlin' })
const nextPoll = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(NOW.getTime() + 11 * 60_000))

describe('why a Screen is or is not showing', () => {
  it('the Active Screen', () => {
    expect(whyOf(SCREENS[1]!)).toEqual(['On the Device since the 07:42 poll.'])
  })

  it('the Active Screen, paused', () => {
    expect(whyOf(SCREENS[1]!, kitchen({ sleep: ASLEEP }))).toEqual(['On hold while Kitchen is in Sleep Mode.'])
  })

  it('up next, with the time of the next poll until that has passed', () => {
    expect(whyOf(SCREENS[2]!)).toEqual([`Shows at the next poll, around ${nextPoll}.`])
    expect(whyOf(SCREENS[2]!, kitchen({ nextPollAt: new Date(NOW.getTime() - 60_000).toISOString() }))).toEqual(['Shows at its next poll.'])
  })

  it('with its Schedule off', () => {
    expect(whyOf(SCREENS[3]!)).toEqual(['Its Schedule is switched off, so Rotation passes over it. The days and hours are kept.'])
  })

  it('not today, by weekday: names today in the server\'s timezone', () => {
    const screen = buildScreen({ state: 'notToday', stateCause: 'weekday', schedule: buildSchedule({ weekdays: [0, 6] }) })

    expect(whyOf(screen)).toEqual(['Its Schedule leaves out Thursdays, so Rotation passes over it today.'])
  })

  it('not today, by dates', () => {
    const screen = buildScreen({ state: 'notToday', stateCause: 'dateRange', schedule: buildSchedule({ startDate: '2026-03-01', endDate: '2026-08-31' }) })

    expect(whyOf(screen)).toEqual(['Its Schedule only runs from 1 March to 31 August, so Rotation passes over it.'])
  })

  it('not at this hour: the Schedule\'s hours and the server\'s time', () => {
    const screen = buildScreen({ state: 'notThisHour', schedule: buildSchedule({ startTime: '06:00', endTime: '09:00' }) })

    expect(whyOf(screen)).toEqual(['Its Schedule runs 06:00–09:00 and it is 12:10, so Rotation passes over it.'])
  })

  it('skipping', () => {
    expect(whyOf(buildScreen({ state: 'skipping', renderSignal: 'skip' }))).toEqual([
      'Skipping: this Screen\'s own content asked to be left out of Rotation for now. It returns by itself when the content changes.',
    ])
  })

  it('no state: it waits its turn after the nearest Screen before it that Rotation does not pass over', () => {
    expect(whyOf(SCREENS[4]!)).toEqual(['Waiting its turn. It comes after Harbour photo.'])
    expect(whyOf(SCREENS[0]!)).toEqual(['Waiting its turn. It comes after Notes.'])
  })

  it('on a mirrored Device', () => {
    expect(whyOf(buildScreen({ renderSignal: 'hold' }), kitchen({ isMirrored: true }))).toEqual([
      'Kept while Mirroring is on. It takes its place in Rotation again when Mirroring is switched off.',
    ])
  })

  it('adds that it is also skipping under a Schedule reason', () => {
    const screen = buildScreen({ state: 'scheduleOff', renderSignal: 'skip', schedule: buildSchedule({ enabled: false }) })

    expect(whyOf(screen)[1]).toBe('It is also skipping: its own content asked to be left out of Rotation.')
  })

  it('adds that it is holding its image', () => {
    expect(whyOf({ ...SCREENS[1]!, renderSignal: 'hold' })[1]).toBe('Holding image: its own content asked to keep the previous image, so nothing new is rendered for it.')
  })
})

describe('the words of a Screen State on its row', () => {
  it.each([
    ['active', null, false, 'Active Screen', undefined],
    ['active', null, true, 'Active Screen, paused', undefined],
    ['active', 'hold', false, 'Active Screen', 'holding image'],
    ['upNext', null, false, 'Up next', undefined],
    ['upNext', null, true, 'Up next at 06:00', undefined],
    ['upNext', 'hold', false, 'Up next', 'holding image'],
    [null, 'hold', false, 'Holding image', undefined],
    [null, null, false, '', undefined],
    ['scheduleOff', null, false, 'Schedule off', undefined],
    ['notToday', null, false, 'Not today', undefined],
    ['notThisHour', null, false, 'Not at this hour', undefined],
    ['skipping', 'skip', false, 'Skipping', undefined],
  ] as const)('%s with the Render Signal %s, asleep %s: "%s"', (state, renderSignal, asleep, words, qualifier) => {
    const device = kitchen(asleep ? { sleep: ASLEEP } : {})

    expect(screenStateWords(buildScreen({ state, renderSignal }), device)).toEqual({ words, qualifier })
  })

  it('are none on a mirrored Device', () => {
    expect(screenStateWords(buildScreen({ renderSignal: 'hold' }), kitchen({ isMirrored: true }))).toEqual({ words: '', qualifier: undefined })
  })
})

describe('the Schedule summary of a row', () => {
  it('marks the seven days, Monday first, with the hours', () => {
    const summary = scheduleSummary(buildSchedule({ weekdays: [1, 2, 3, 4, 5], startTime: '06:00', endTime: '09:00' }))

    expect(summary.days.map(day => day.on ? day.letter : '·').join('')).toBe('MTWTF··')
    expect(summary.hours).toBe('06:00–09:00')
    expect(summary.said).toBe('Monday, Tuesday, Wednesday, Thursday, Friday, 06:00–09:00')
  })

  it('reads "all day" without hours and every day without weekdays', () => {
    const summary = scheduleSummary(buildSchedule({ weekdays: null, startTime: null, endTime: null }))

    expect(summary.days.every(day => day.on)).toBe(true)
    expect(summary.hours).toBe('all day')
    expect(summary.said).toBe('Every day, all day')
  })

  it('puts Sunday, the weekday 0, last', () => {
    expect(scheduleSummary(buildSchedule({ weekdays: [0, 6] })).days.map(day => day.on)).toEqual([false, false, false, false, false, true, true])
  })
})
