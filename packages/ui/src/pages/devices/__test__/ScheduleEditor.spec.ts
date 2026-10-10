import type { ScheduleRead } from 'kuroshiro-shared'
import type { Locator } from 'vitest/browser'
import type { MountedApp } from './screensViewHarness'
import { http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { buildSchedule } from '@/testing/fixtures/screens'
import { withCoarsePointer } from '@/testing/media'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { fakeKitchen, openedRow, SCREENS_OF_EVERY_KIND, words } from './screensViewHarness'

afterEach(() => resetViewport())

/** Monday to Friday, 06:00 to 09:00, on. */
const WEEKDAY_MORNINGS = buildSchedule()

/** Kitchen's Screens, the File Screen "Harbour photo" with the Schedule. */
function photoWith(schedule: ScheduleRead, state: 'scheduleOff' | null = null) {
  return SCREENS_OF_EVERY_KIND.map(screen => screen.id === 'photo' ? { ...screen, schedule, state } : screen)
}

async function openedPhoto(schedule?: ScheduleRead, kitchen: Omit<Parameters<typeof fakeKitchen>[0], 'screens'> = {}) {
  const faked = fakeKitchen({ ...kitchen, screens: schedule ? photoWith(schedule, schedule.enabled ? null : 'scheduleOff') : SCREENS_OF_EVERY_KIND })
  const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
  const row = await openedRow(screen, 'Harbour photo')
  const editor = row.getByRole('group', { name: 'Schedule', exact: true })
  await expect.element(editor).toBeVisible()
  return { faked, screen, row, editor }
}

const photoRow = () => document.querySelector('#screen-photo')!
const rowSummary = () => words(photoRow().querySelector('.schedule-summary .visually-hidden') ?? photoRow().querySelector('.schedule-summary'))
const rowState = () => words(photoRow().querySelector('.state'))
const rowSwitch = (screen: MountedApp) => screen.getByRole('switch', { name: 'Schedule for Harbour photo' })
const pressedDays = (editor: Locator) => [...editor.element().querySelectorAll('[aria-pressed="true"], [data-state="on"]')].map(day => day.getAttribute('aria-label'))
const patch = (body: unknown) => ({ method: 'PATCH', path: 'screens/photo/schedule', body })
const failsOnce = (method: 'post' | 'patch' | 'delete') => api.use(http[method](apiUrl('screens/photo/schedule'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))

async function enter(field: Locator, value: string) {
  await field.fill(value)
  ;(field.element() as HTMLElement).blur()
}

const hours = (editor: Locator) => editor.getByRole('group', { name: 'Hours' })
const dates = (editor: Locator) => editor.getByRole('group', { name: 'Dates' })
const end = (pair: Locator, label: 'From' | 'to') => pair.getByLabelText(label, { exact: true })
const dialog = () => document.querySelector('[role="alertdialog"]')
const outcome = () => [...dialog()!.querySelectorAll('.outcome > div')].map(part => `${words(part.querySelector('dt'))} ${words(part.querySelector('dd'))}`)

describe('a Screen without a Schedule', () => {
  it('reads as always shown, without a switch on its row', async () => {
    const { screen, editor } = await openedPhoto()

    await expect.element(editor.getByText('Always shown. A Schedule limits this Screen to certain days and hours.')).toBeVisible()
    expect(rowSummary()).toBe('Always shown')
    expect(rowSwitch(screen).elements()).toEqual([])
    expect(editor.getByRole('switch').elements()).toEqual([])
  })

  it('"Add a Schedule" creates one for every day, all day, switched on, and hands the focus to its switch', async () => {
    const { faked, screen, editor } = await openedPhoto()

    await editor.getByRole('button', { name: 'Add a Schedule' }).click()

    const scheduleSwitch = editor.getByRole('switch', { name: 'Schedule', exact: true })
    await expect.element(scheduleSwitch).toHaveFocus()
    await expect.element(scheduleSwitch).toBeChecked()
    expect(faked.writes).toEqual([{ method: 'POST', path: 'screens/photo/schedule', body: { enabled: true, weekdays: null, startTime: null, endTime: null, startDate: null, endDate: null } }])
    expect(pressedDays(editor)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    await expect.element(editor.getByRole('checkbox', { name: 'All day' })).toBeChecked()
    await expect.element(editor.getByRole('checkbox', { name: 'Only between two dates' })).not.toBeChecked()
    expect(rowSummary()).toBe('Every day, all day')
    await expect.element(rowSwitch(screen)).toBeChecked()
  })

  it('says why a Schedule could not be added, and stays always shown', async () => {
    const { editor } = await openedPhoto()
    failsOnce('post')

    await editor.getByRole('button', { name: 'Add a Schedule' }).click()

    await expect.element(editor.getByText('Something went wrong on the server.')).toBeVisible()
    await expect.element(editor.getByRole('button', { name: 'Add a Schedule' })).toBeEnabled()
    expect(rowSummary()).toBe('Always shown')
  })
})

describe('the Schedule switch on a row', () => {
  it('switches the Schedule off with one PATCH, strikes the summary through and moves the row to "Schedule off"', async () => {
    const { faked, screen, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    await expect.element(editor.getByText('on', { exact: true })).toBeVisible()

    await rowSwitch(screen).click()

    await expect.poll(rowState).toBe('Schedule off')
    expect(faked.writes).toEqual([patch({ enabled: false })])
    await expect.element(rowSwitch(screen)).not.toBeChecked()
    expect(getComputedStyle(photoRow().querySelector('.schedule-summary .hours')!).textDecorationLine).toBe('line-through')
    await expect.element(editor.getByText('off, days and hours kept')).toBeVisible()
    await expect.element(editor.getByRole('switch', { name: 'Schedule', exact: true })).not.toBeChecked()
    expect(pressedDays(editor)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
  })

  it('switches it on again from the editor\'s own switch', async () => {
    const { faked, screen, editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, enabled: false })
    expect(rowState()).toBe('Schedule off')

    await editor.getByRole('switch', { name: 'Schedule', exact: true }).click()

    await expect.element(rowSwitch(screen)).toBeChecked()
    expect(faked.writes).toEqual([patch({ enabled: true })])
    expect(rowState()).toBe('')
  })

  it('keeps the admin\'s value when the save fails, and saves on "Try again"', async () => {
    const { faked, screen } = await openedPhoto(WEEKDAY_MORNINGS)
    failsOnce('patch')
    const line = screen.getByRole('button', { name: 'Harbour photo', exact: true })

    await rowSwitch(screen).click()

    await expect.poll(() => words(photoRow().querySelector('.save-state .said'))).toBe('Not saved. Something went wrong on the server.')
    await expect.element(rowSwitch(screen)).not.toBeChecked()
    expect(rowState()).toBe('')
    expect(faked.writes).toEqual([])

    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(rowState).toBe('Schedule off')
    expect(faked.writes).toEqual([patch({ enabled: false })])
    await expect.element(line).toHaveAttribute('aria-expanded', 'true')
  })

  it('works on a phone without opening the row, on a 44 px target', async () => {
    const faked = fakeKitchen({ screens: photoWith(WEEKDAY_MORNINGS) })
    await resizeTo(375)
    const screen = await mountApp({ at: '/devices/kitchen' })
    await expect.element(rowSwitch(screen)).toBeVisible()

    await withCoarsePointer(async () => {
      expect(rowSwitch(screen).element().closest('label')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      await rowSwitch(screen).click()
      await expect.poll(rowState).toBe('Schedule off')
    })

    expect(faked.writes).toEqual([patch({ enabled: false })])
    expect(new URL(location.href).searchParams.get('screen')).toBeNull()
    await expectNoHorizontalOverflow()
  })
})

describe('the weekdays', () => {
  it('stand Monday first and save the stored numbers, Sunday as 0', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    const days = editor.getByRole('group', { name: 'Days' })

    expect(days.getByRole('button').elements().map(day => day.getAttribute('aria-label'))).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    await days.getByRole('button', { name: 'Sunday' }).click()
    await expect.element(editor.getByText('Saved')).toBeVisible()
    await days.getByRole('button', { name: 'Monday' }).click()

    await expect.poll(() => faked.writes).toEqual([patch({ weekdays: [0, 1, 2, 3, 4, 5] }), patch({ weekdays: [0, 2, 3, 4, 5] })])
    await expect.poll(rowSummary).toBe('Tuesday, Wednesday, Thursday, Friday, Sunday, 06:00–09:00')
  })

  it('cannot lose their last selected day', async () => {
    const { faked, editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, weekdays: [0] })

    await editor.getByRole('button', { name: 'Sunday' }).click()
    await editor.getByRole('button', { name: 'Saturday' }).click()

    await expect.poll(() => faked.writes).toEqual([patch({ weekdays: [0, 6] })])
    expect(pressedDays(editor)).toEqual(['Saturday', 'Sunday'])
  })

  it('keep the admin\'s days when the save fails, and save them on "Try again"', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    failsOnce('patch')

    await editor.getByRole('button', { name: 'Saturday' }).click()

    await expect.element(editor.getByText('Not saved. Something went wrong on the server.')).toBeVisible()
    expect(pressedDays(editor)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    expect(faked.writes).toEqual([])

    await editor.getByRole('button', { name: 'Try again' }).click()

    await expect.element(editor.getByText('Saved')).toBeVisible()
    expect(faked.writes).toEqual([patch({ weekdays: [1, 2, 3, 4, 5, 6] })])
  })
})

describe('a save that did not go through', () => {
  it('is saved together with the next change', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    failsOnce('patch')

    await editor.getByRole('button', { name: 'Saturday' }).click()
    await expect.element(editor.getByText('Not saved. Something went wrong on the server.')).toBeVisible()
    await editor.getByRole('checkbox', { name: 'All day' }).click()

    await expect.element(editor.getByText('Saved')).toBeVisible()
    expect(faked.writes).toEqual([patch({ weekdays: [1, 2, 3, 4, 5, 6], startTime: null, endTime: null })])
    expect(pressedDays(editor)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
  })

  it('is not lost when it fails while a later change is being saved', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    let failFirstSave = () => {}
    const firstSaveHeld = new Promise<void>(resolve => (failFirstSave = resolve))
    api.use(http.patch(apiUrl('screens/photo/schedule'), async () => {
      await firstSaveHeld
      return apiErrorResponse({ statusCode: 500, code: 'internal' })
    }, { once: true }))

    await editor.getByRole('button', { name: 'Saturday' }).click()
    await editor.getByRole('checkbox', { name: 'All day' }).click()
    await expect.element(editor.getByText('Saved')).toBeVisible()
    failFirstSave()

    expect(faked.writes).toEqual([patch({ weekdays: [1, 2, 3, 4, 5, 6], startTime: null, endTime: null })])
    await expect.poll(rowSummary).toBe('Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, all day')
  })

  it('gives way to the saved time typed back in its place', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    failsOnce('patch')

    await enter(end(hours(editor), 'From'), '10:00')
    await expect.element(editor.getByText('Not saved. Something went wrong on the server.')).toBeVisible()
    await enter(end(hours(editor), 'From'), '06:00')

    await expect.element(editor.getByText('Saved')).toBeVisible()
    expect(faked.writes).toEqual([patch({ startTime: '06:00', endTime: '09:00' })])
  })
})

describe('the hours', () => {
  it('save the one time that changed, on blur', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)

    await enter(end(hours(editor), 'From'), '07:30')

    await expect.poll(() => faked.writes).toEqual([patch({ startTime: '07:30' })])
    await expect.poll(rowSummary).toBe('Monday, Tuesday, Wednesday, Thursday, Friday, 07:30–09:00')
    expect(editor.getByText('This window crosses midnight.').elements()).toEqual([])
  })

  it('never send half a pair, and say when the window crosses midnight', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)

    await enter(end(hours(editor), 'to'), '')
    await enter(end(hours(editor), 'From'), '21:00')
    expect(faked.writes).toEqual([])

    await enter(end(hours(editor), 'to'), '05:00')

    await expect.poll(() => faked.writes).toEqual([patch({ startTime: '21:00', endTime: '05:00' })])
    await expect.element(editor.getByText('This window crosses midnight.')).toBeVisible()
  })

  it('"All day" clears both times and hides them; unchecked, it fills in 06:00 to 09:00', async () => {
    const { faked, editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, startTime: '10:00', endTime: '12:00' })
    const allDay = editor.getByRole('checkbox', { name: 'All day' })

    await allDay.click()

    await expect.poll(() => faked.writes).toEqual([patch({ startTime: null, endTime: null })])
    expect(end(hours(editor), 'From').elements()).toEqual([])
    await expect.poll(rowSummary).toBe('Monday, Tuesday, Wednesday, Thursday, Friday, all day')

    await allDay.click()

    await expect.poll(() => faked.writes.at(-1)).toEqual(patch({ startTime: '06:00', endTime: '09:00' }))
    await expect.element(end(hours(editor), 'From')).toHaveValue('06:00')
    await expect.element(end(hours(editor), 'to')).toHaveValue('09:00')
    expect(faked.writes).toHaveLength(2)
  })
})

describe('the date range', () => {
  it('"Only between two dates" fills in today and a week from today and saves them; unchecked, it clears both', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    const ranged = editor.getByRole('checkbox', { name: 'Only between two dates' })

    await ranged.click()

    await expect.poll(() => faked.writes).toEqual([patch({ startDate: '2026-10-03', endDate: '2026-10-10' })])
    await expect.element(end(dates(editor), 'From')).toHaveValue('2026-10-03')
    await expect.element(end(dates(editor), 'to')).toHaveValue('2026-10-10')
    await expect.element(editor.getByText('Both days count.')).toBeVisible()

    await ranged.click()

    await expect.poll(() => faked.writes.at(-1)).toEqual(patch({ startDate: null, endDate: null }))
    expect(end(dates(editor), 'From').elements()).toEqual([])
    expect(faked.writes).toHaveLength(2)
  })

  it('refuses a first day after the last day on the field, without a call, and saves the pair once it is valid', async () => {
    const { faked, editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, startDate: '2026-10-03', endDate: '2026-10-10' })
    const firstDay = end(dates(editor), 'From')

    await enter(firstDay, '2026-10-20')

    await expect.element(editor.getByText('The first day is after the last day.')).toBeVisible()
    await expect.element(firstDay).toHaveAttribute('aria-invalid', 'true')
    await expect.element(firstDay).toHaveAccessibleDescription('The first day is after the last day.')
    expect(faked.writes).toEqual([])

    await enter(end(dates(editor), 'to'), '2026-10-25')

    await expect.poll(() => faked.writes).toEqual([patch({ startDate: '2026-10-20', endDate: '2026-10-25' })])
    expect(editor.getByText('The first day is after the last day.').elements()).toEqual([])
    await expect.element(firstDay).not.toHaveAttribute('aria-invalid')
  })

  it('never sends a range with an empty day', async () => {
    const { faked, editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, startDate: '2026-10-03', endDate: '2026-10-10' })

    await enter(end(dates(editor), 'to'), '')
    await enter(end(dates(editor), 'From'), '2026-10-05')

    expect(faked.writes).toEqual([])
  })

  it('says when the last day has passed', async () => {
    const { editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, startDate: '2026-09-01', endDate: '2026-10-02' })

    await expect.element(editor.getByText('The last day has passed, so this Screen no longer shows.')).toBeVisible()
  })

  it('does not say so on the last day itself', async () => {
    const { editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, startDate: '2026-09-01', endDate: '2026-10-03' })

    await expect.element(editor.getByText('Both days count.')).toBeVisible()
    expect(editor.getByText('The last day has passed, so this Screen no longer shows.').elements()).toEqual([])
  })
})

describe('the timezone line', () => {
  it('names the timezone of the Instance facts', async () => {
    const { editor } = await openedPhoto(WEEKDAY_MORNINGS, { instance: buildInstanceFacts({ timezone: 'America/New_York' }) })

    await expect.element(editor.getByText('Hours and dates are in the server\'s timezone, America/New_York.')).toBeVisible()
  })
})

describe('"Remove Schedule"', () => {
  it('confirms, deletes the Schedule and leaves the Screen always shown', async () => {
    const { faked, screen, editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, enabled: false })

    await editor.getByRole('button', { name: 'Remove Schedule' }).click()

    await expect.element(screen.getByRole('alertdialog', { name: 'Remove Harbour photo\'s Schedule?' })).toBeVisible()
    expect(words(dialog()!.querySelector('.body p'))).toBe('To keep the days and hours and only stop showing it, switch the Schedule off instead.')
    expect(outcome()).toEqual(['Lost Its days, hours and dates.', 'Stays Harbour photo itself, which is then always shown.'])
    expect(faked.writes).toEqual([])

    await screen.getByRole('alertdialog').getByRole('button', { name: 'Remove Schedule' }).click()

    await expect.element(editor.getByRole('button', { name: 'Add a Schedule' })).toHaveFocus()
    expect(faked.writes).toEqual([{ method: 'DELETE', path: 'screens/photo/schedule' }])
    expect(rowSummary()).toBe('Always shown')
    expect(rowState()).toBe('')
    expect(rowSwitch(screen).elements()).toEqual([])
  })

  it('keeps the Schedule when the admin cancels', async () => {
    const { faked, screen, editor } = await openedPhoto(WEEKDAY_MORNINGS)

    await editor.getByRole('button', { name: 'Remove Schedule' }).click()
    await screen.getByRole('button', { name: 'Cancel' }).click()

    await expect.element(editor.getByRole('button', { name: 'Remove Schedule' })).toHaveFocus()
    expect(faked.writes).toEqual([])
  })

  it('says why in the confirmation when the Schedule could not be removed', async () => {
    const { screen, editor } = await openedPhoto(WEEKDAY_MORNINGS)
    failsOnce('delete')

    await editor.getByRole('button', { name: 'Remove Schedule' }).click()
    await screen.getByRole('alertdialog').getByRole('button', { name: 'Remove Schedule' }).click()

    await expect.element(screen.getByRole('alertdialog').getByText('Something went wrong on the server.')).toBeVisible()
  })
})

describe('the Schedule editor', () => {
  it('follows a Schedule the server changed, at the next refresh', async () => {
    const { faked, editor } = await openedPhoto(WEEKDAY_MORNINGS)

    faked.screens = photoWith({ ...WEEKDAY_MORNINGS, weekdays: [6, 0], startTime: null, endTime: null })
    window.dispatchEvent(new Event('focus'))

    await expect.poll(() => pressedDays(editor)).toEqual(['Saturday', 'Sunday'])
    await expect.element(editor.getByRole('checkbox', { name: 'All day' })).toBeChecked()
  })

  it('is usable on a phone, every control a 44 px target', async () => {
    const faked = fakeKitchen({ screens: photoWith({ ...WEEKDAY_MORNINGS, startDate: '2026-10-03', endDate: '2026-10-10' }) })
    await resizeTo(375)
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const editor = (await openedRow(screen, 'Harbour photo')).getByRole('group', { name: 'Schedule', exact: true })

    await withCoarsePointer(async () => {
      const targets = [
        ...editor.getByRole('button').elements(),
        ...editor.element().querySelectorAll('input:not([type="checkbox"])'),
        ...[...editor.element().querySelectorAll('input[type="checkbox"], [role="switch"]')].map(control => control.closest('label')!),
      ]
      expect(targets).toHaveLength(7 + 1 + 4 + 3)
      expect(targets.filter(target => target.getBoundingClientRect().height < 44).map(words)).toEqual([])
      const days = editor.getByRole('group', { name: 'Days' }).getByRole('button').elements()
      expect(days.filter(day => day.getBoundingClientRect().width < 44).map(day => day.getAttribute('aria-label'))).toEqual([])
      await editor.getByRole('button', { name: 'Saturday' }).click()
      // Waits for the Saturday save to land before the next one starts, so a loaded CI runner
      // can't let the two saves overlap and coalesce into one (the growing-entry behaviour
      // `useSaveAsChanged` relies on for a change made *during* a save).
      await expect.poll(() => faked.writes).toEqual([patch({ weekdays: [1, 2, 3, 4, 5, 6] })])
      await editor.getByRole('checkbox', { name: 'All day' }).click()
      await expectNoHorizontalOverflow()
    })

    await expect.poll(() => faked.writes).toEqual([patch({ weekdays: [1, 2, 3, 4, 5, 6] }), patch({ startTime: null, endTime: null })])
    await expectNoHorizontalOverflow()
  })

  it.for([
    ['without a Schedule', undefined],
    ['with hours and a date range that has passed', { ...WEEKDAY_MORNINGS, startTime: '22:00', endTime: '06:00', startDate: '2026-09-01', endDate: '2026-09-30' }],
    ['switched off, all day', { ...WEEKDAY_MORNINGS, enabled: false, startTime: null, endTime: null }],
  ] as const)('is accessible and does not scroll sideways %s', async ([, schedule]) => {
    await openedPhoto(schedule)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is accessible while a first day is refused and a save has failed', async () => {
    const { editor } = await openedPhoto({ ...WEEKDAY_MORNINGS, startDate: '2026-10-03', endDate: '2026-10-10' })
    failsOnce('patch')

    await editor.getByRole('button', { name: 'Saturday' }).click()
    await expect.element(editor.getByText('Not saved. Something went wrong on the server.')).toBeVisible()
    await enter(end(dates(editor), 'From'), '2026-10-20')
    await expect.element(editor.getByText('The first day is after the last day.')).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
