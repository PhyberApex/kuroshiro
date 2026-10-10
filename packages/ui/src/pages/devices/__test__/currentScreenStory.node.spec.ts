import type { CurrentScreen } from 'kuroshiro-shared'
import type { Sentence } from '../sentence'
import { describe, expect, it } from 'vitest'
import { buildAlert } from '@/testing/fixtures/alerts'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { buildScreen } from '@/testing/fixtures/screens'
import { currentScreenStory } from '../currentScreenStory'

const at = (hours: number, minutes: number) => new Date(2026, 9, 3, hours, minutes).toISOString()
const NOW = new Date(2026, 9, 3, 7, 35)

const SCREENS = [
  buildScreen({ id: 'weather', name: 'Weather', order: 1 }),
  buildScreen({ id: 'calendar', name: 'Calendar', order: 2, state: 'active' }),
  buildScreen({ id: 'photo', name: 'Harbour photo', order: 3, kind: 'file', state: 'upNext' }),
]

const CALENDAR_SERVED: CurrentScreen = {
  kind: 'screen',
  screenId: 'calendar',
  name: 'Calendar',
  imagePath: '/screens/devices/kitchen/calendar.png?v=1',
  renderedAt: at(7, 31),
  servedAt: at(7, 31),
  paused: false,
  holding: false,
}

function fallback(fallbackKind: 'welcome' | 'noScreen' | 'error' | 'sleep', reason: 'neverPolled' | 'noScreens' | 'noneEligible' | 'renderFailed' | 'mirrorFailed' | 'asleep', screenId: string | null = null): CurrentScreen {
  return {
    kind: 'fallback',
    fallback: fallbackKind,
    reason,
    screenId,
    imagePath: `/screens/devices/kitchen/${fallbackKind}.png?v=1`,
    servedAt: reason === 'neverPolled' ? null : at(7, 31),
  }
}

const ASLEEP = { enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback' as const, inWindow: true, endsAt: at(6, 0) }
const OFFLINE = buildAlert({ kind: 'device-offline' })

function kitchen(overrides: Parameters<typeof buildDeviceDetail>[0] = {}) {
  return buildDeviceDetail({
    id: 'kitchen',
    name: 'Kitchen',
    lastSeenAt: at(7, 31),
    nextPollAt: at(7, 46),
    currentScreen: CALENDAR_SERVED,
    ...overrides,
  })
}

const said = (sentences: Sentence[]) => sentences.map(sentence => sentence.map(part => part.text).join(''))

describe('what the plate shows and the sentences beside it', () => {
  it('an Active Screen: its name, its place in the Order and what is up next, under the seal', () => {
    const story = currentScreenStory({ device: kitchen(), screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'active', heading: 'Calendar', sealed: true, stampKey: 'calendar' })
    expect(said(story.sentences)).toEqual([
      'The Current Screen. Order 2 of 3, on the Device since the 07:31 poll.',
      'Up next: Harbour photo, at the poll around 07:46.',
    ])
    expect(story.sentences[1]).toContainEqual({ text: 'Harbour photo', strong: true })
  })

  it('says "at its next poll" without a time once the moment of the next poll has passed', () => {
    const story = currentScreenStory({ device: kitchen({ nextPollAt: at(7, 34) }), screens: SCREENS, alerts: [], now: NOW })

    expect(said(story.sentences)[1]).toBe('Up next: Harbour photo, at its next poll.')
  })

  it('an Active Screen with no other Screen to show stays on', () => {
    const alone = SCREENS.map(screen => screen.state === 'upNext' ? { ...screen, state: 'scheduleOff' as const } : screen)
    const story = currentScreenStory({ device: kitchen(), screens: alone, alerts: [], now: NOW })

    expect(said(story.sentences)[1]).toBe('No other Screen can be shown right now, so it stays on.')
  })

  it('names the Active Screen from the Screens read when the last-served record has no name, and leaves the Order out for a Screen deleted since', () => {
    const unnamed = kitchen({ currentScreen: { ...CALENDAR_SERVED, name: '' } })

    expect(currentScreenStory({ device: unnamed, screens: SCREENS, alerts: [], now: NOW }).heading).toBe('Calendar')

    const deleted = currentScreenStory({ device: kitchen(), screens: SCREENS.filter(screen => screen.id !== 'calendar'), alerts: [], now: NOW })

    expect(said(deleted.sentences)[0]).toBe('The Current Screen, on the Device since the 07:31 poll.')
  })

  it('shows the sleep Fallback Screen while Sleep Mode is in its window', () => {
    const device = kitchen({ sleep: ASLEEP, currentScreen: fallback('sleep', 'asleep') })
    const story = currentScreenStory({ device, screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'asleep', heading: 'Asleep until 06:00', sealed: false })
    expect(said(story.sentences)).toEqual([
      'Sleep Mode is in its window, so Kitchen shows the sleep Fallback Screen.',
      'Rotation resumes at 06:00 with Harbour photo.',
    ])
  })

  it('keeps the image while Sleep Mode is in its window: the name of the Screen without the seal', () => {
    const device = kitchen({ sleep: { ...ASLEEP, whileAsleep: 'keep' }, currentScreen: { ...CALENDAR_SERVED, paused: true } })
    const story = currentScreenStory({ device, screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'asleepKeeping', heading: 'Calendar', sealed: false })
    expect(said(story.sentences)).toEqual([
      'Sleep Mode is in its window until 06:00 and keeps this image on the Device.',
      'Rotation resumes at 06:00 with Harbour photo.',
    ])
  })

  it('no Screens', () => {
    const story = currentScreenStory({ device: kitchen({ currentScreen: fallback('noScreen', 'noScreens') }), screens: [], alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'noScreens', heading: 'No Screens yet', sealed: false })
    expect(said(story.sentences)).toEqual(['Kitchen shows the no-screen Fallback Screen until you add one.'])
  })

  it('has Screens, but none can be shown', () => {
    const story = currentScreenStory({ device: kitchen({ currentScreen: fallback('noScreen', 'noneEligible') }), screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'noneEligible', heading: 'No Screen to show', sealed: false })
    expect(said(story.sentences)).toEqual([
      'Rotation passes over every Screen here right now, so Kitchen shows the no-screen Fallback Screen.',
      'Open a Screen below to see why.',
    ])
  })

  it('the Active Screen could not be rendered: its name comes from the Screens read', () => {
    const story = currentScreenStory({ device: kitchen({ currentScreen: fallback('error', 'renderFailed', 'weather') }), screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'renderFailed', heading: 'Weather could not be shown', sealed: false })
    expect(said(story.sentences)).toEqual([
      'Kuroshiro could not produce Weather\'s image at the 07:31 poll, so Kitchen shows the error Fallback Screen. It tries again when the Screen\'s turn next comes.',
    ])
  })

  it('mirrors a TRMNL Device: the mirror MAC address in mono', () => {
    const device = kitchen({ isMirrored: true, currentScreen: { kind: 'mirror', proxied: false, mirrorMac: 'A4:CF:12:9B:01:7E', imagePath: '/screens/devices/kitchen/mirror.png?v=1', fetchedAt: at(7, 31) } })
    const story = currentScreenStory({ device, screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'mirrored', heading: 'Mirrored from TRMNL', sealed: false })
    expect(said(story.sentences)).toEqual([
      'The Current Screen is the image of the TRMNL Device A4:CF:12:9B:01:7E, fetched at the 07:31 poll.',
      'Kitchen\'s own Screens are kept but not shown.',
    ])
    expect(story.sentences[0]).toContainEqual({ text: 'A4:CF:12:9B:01:7E', mono: true })
  })

  it('a Proxied Device', () => {
    const device = kitchen({ isMirrored: true, isProxied: true, currentScreen: { kind: 'mirror', proxied: true, mirrorMac: 'A4:C1:38:5F:0B:9D', imagePath: '/screens/devices/kitchen/mirror.png?v=1', fetchedAt: at(7, 31) } })
    const story = currentScreenStory({ device, screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'proxied', heading: 'Mirrored from TRMNL', sealed: false })
    expect(said(story.sentences)).toEqual([
      'The Current Screen is the image of this same Device on TRMNL\'s server, fetched at the 07:31 poll.',
      'Kitchen is a Proxied Device: TRMNL answers its polls and decides its refresh rate and Firmware.',
    ])
  })

  it('failed Mirroring: when it tries again and a link to Settings', () => {
    const device = kitchen({ isMirrored: true, currentScreen: fallback('error', 'mirrorFailed') })
    const story = currentScreenStory({ device, screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'mirrorFailed', heading: 'Mirroring failed', sealed: false })
    expect(said(story.sentences)).toEqual([
      'Kuroshiro could not fetch the image from TRMNL at the 07:31 poll, so Kitchen shows the error Fallback Screen. It tries again at the next poll, around 07:46.',
      'Check the mirror MAC address and API key in Settings.',
    ])
    expect(story.sentences[1]).toContainEqual({ text: 'Settings', to: '/devices/kitchen/settings' })

    const late = currentScreenStory({ device: { ...device, nextPollAt: at(7, 34) }, screens: SCREENS, alerts: [], now: NOW })

    expect(said(late.sentences)[0]).toMatch(/It tries again at its next poll\.$/)
  })

  it('offline: the last image without the seal, and what is up next when it calls in again', () => {
    const story = currentScreenStory({ device: kitchen(), screens: SCREENS, alerts: [OFFLINE], now: NOW })

    expect(story).toMatchObject({ state: 'offline', heading: 'Calendar', sealed: false })
    expect(said(story.sentences)).toEqual([
      'The last image Kitchen was given: Order 2 of 3, at the 07:31 poll. It has not called in since.',
      'Up next: Harbour photo, when Kitchen calls in again.',
    ])
  })

  it('the Screen it shows was deleted: no image, and when it moves on', () => {
    const device = kitchen({ currentScreen: { kind: 'deletedScreen', imagePath: null, servedAt: at(7, 31) } })
    const story = currentScreenStory({ device, screens: SCREENS, alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'deletedScreen', heading: 'The Screen was deleted', sealed: false })
    expect(said(story.sentences)).toEqual(['The Screen Kitchen shows was deleted. At its next poll, around 07:46, it moves on.'])
  })

  it('leaves the time out once the moment of the next poll has passed', () => {
    const device = kitchen({ nextPollAt: at(7, 34), currentScreen: { kind: 'deletedScreen', imagePath: null, servedAt: at(7, 31) } })
    const story = currentScreenStory({ device, screens: SCREENS, alerts: [], now: NOW })

    expect(said(story.sentences)).toEqual(['The Screen Kitchen shows was deleted. At its next poll, it moves on.'])
  })

  it('never polled', () => {
    const device = kitchen({ lastSeenAt: null, nextPollAt: null, currentScreen: fallback('welcome', 'neverPolled') })
    const story = currentScreenStory({ device, screens: [], alerts: [], now: NOW })

    expect(story).toMatchObject({ state: 'neverPolled', heading: 'Waiting for Kitchen\'s first poll', sealed: false })
    expect(said(story.sentences)).toEqual(['Kitchen is registered and has not called in yet.'])
  })
})
