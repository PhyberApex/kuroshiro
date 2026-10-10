import type { ScreenRead } from 'kuroshiro-shared'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { buildScreen } from '@/testing/fixtures/screens'
import { isFirefox, withCoarsePointer, withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { forceTheme, THEMES } from '@/testing/theme'
import { resetViewport, resizeTo } from '@/testing/viewport'
import ScreenRowGallery from '../ScreenRow.gallery.vue'
import ScreenRow from '../ScreenRow.vue'
import { SCREEN_KIND_LABELS } from '../screenRows'
import ScreenRows from '../ScreenRows.vue'

const SCREENS: ScreenRead[] = [
  buildScreen({ id: 'calendar', name: 'Calendar', state: 'active' }),
  buildScreen({ id: 'weather', name: 'Weather', state: 'upNext' }),
  buildScreen({ id: 'weekend', name: 'Weekend board', kind: 'mashup', state: 'scheduleOff' }),
  buildScreen({ id: 'trains', name: 'Train departures' }),
]
const NAMES = SCREENS.map(screen => screen.name)

interface ListOptions {
  sortable?: boolean
  /** What the list's owner does with a new order. Left out, it takes it. */
  save?: (ids: string[]) => Promise<unknown>
  onFetch?: (name: string) => void
  force?: object
  screens?: ScreenRead[]
}

function listOf({ sortable = true, save = async () => {}, onFetch = () => {}, force, screens: given = SCREENS }: ListOptions = {}) {
  return defineComponent({
    emits: ['reorder'],
    setup(_, { emit }) {
      const screens = ref(given)
      function takeOrder(ids: string[]) {
        const before = screens.value
        screens.value = ids.map(id => before.find(screen => screen.id === id)!)
        emit('reorder', ids)
        save(ids).catch(() => {
          screens.value = before
        })
      }
      return () => h(ScreenRows<ScreenRead>, { items: screens.value, sortable, force, onReorder: takeOrder }, {
        default: ({ item }: { item: ScreenRead }) => h(ScreenRow, { value: item.id, name: item.name, kind: SCREEN_KIND_LABELS[item.kind], state: item.state }, {
          thumbnail: ({ active, passedOver }: { active: boolean, passedOver: boolean }) => h('span', { 'data-testid': `thumbnail-${item.id}` }, `${active ? 'sealed' : 'plain'} ${passedOver ? 'dimmed' : 'clear'}`),
          schedule: () => h('button', { type: 'button', onClick: () => onFetch(item.name) }, `Fetch ${item.name}`),
          default: () => h('p', `Inside ${item.name}`),
        }),
      })
    },
  })
}

type Mounted = Awaited<ReturnType<typeof mount>>

const rowsOf = (screen: Mounted) => [...screen.container.querySelectorAll('ul > li')]
const namesOf = (screen: Mounted) => rowsOf(screen).map(row => row.querySelector('h3')!.textContent!.trim())
const rowOf = (screen: Mounted, name: string) => rowsOf(screen).find(row => row.querySelector('h3')!.textContent!.trim() === name)!
const gripOf = (screen: Mounted, name: string) => screen.getByRole('button', { name: `Move ${name} in the Order`, exact: true })
const triggerOf = (screen: Mounted, name: string) => screen.getByRole('button', { name, exact: true })

async function onPhone<T>(body: () => Promise<T>) {
  await resizeTo(375)
  try {
    return await body()
  }
  finally {
    await resetViewport()
  }
}

describe('screen row', () => {
  it('is an item of a list: Order, thumbnail, the name as a button under a heading, the kind, the Schedule cell and the Screen State', async () => {
    const screen = await mount(listOf())

    expect(namesOf(screen)).toEqual(NAMES)
    const row = rowOf(screen, 'Weekend board')
    expect(row.parentElement!.localName).toBe('ul')
    expect(row.textContent).toContain('3')
    expect(row.textContent).toContain('Mashup')
    expect(row.textContent).toContain('Schedule off')
    await expect.element(screen.getByRole('heading', { name: 'Weekend board', level: 3 }).getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    await expect.element(screen.getByText('Inside Weekend board')).not.toBeInTheDocument()
  })

  it('cannot stand outside a list of rows', async () => {
    await expect(mount(ScreenRow, { props: { value: 'calendar', name: 'Calendar' } })).rejects.toThrow()
  })

  it.for(['{Enter}', ' '])('opens and closes with %j on its name and exposes its expanded state', async (key) => {
    const screen = await mount(listOf({ sortable: false }))
    const trigger = triggerOf(screen, 'Calendar')

    await userEvent.keyboard('{Tab}')
    await expect.element(trigger).toHaveFocus()
    await userEvent.keyboard(key)

    await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect.element(screen.getByText('Inside Calendar')).toBeVisible()
    expect(trigger.element().getAttribute('aria-controls')).toBe(screen.getByText('Inside Calendar').element().closest('[id]')?.id)

    await userEvent.keyboard(key)

    await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect.element(screen.getByText('Inside Calendar')).not.toBeInTheDocument()
  })

  it('has one row open at a time', async () => {
    const screen = await mount(listOf())

    await triggerOf(screen, 'Calendar').click()
    await expect.element(screen.getByText('Inside Calendar')).toBeVisible()
    await triggerOf(screen, 'Weather').click()

    await expect.element(screen.getByText('Inside Weather')).toBeVisible()
    await expect.element(screen.getByText('Inside Calendar')).not.toBeInTheDocument()
    await expect.element(triggerOf(screen, 'Calendar')).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens from anywhere on its line', async () => {
    const screen = await mount(listOf())

    await screen.getByTestId('thumbnail-weather').click()

    await expect.element(triggerOf(screen, 'Weather')).toHaveAttribute('aria-expanded', 'true')
  })

  it('leaves a control in another slot to do its own work without opening the row', async () => {
    const onFetch = vi.fn()
    const screen = await mount(listOf({ onFetch }))

    await screen.getByRole('button', { name: 'Fetch Weather' }).click()
    await userEvent.keyboard('{Enter}')

    // Firefox's keyboard automation resolves before the native Enter-triggers-click default
    // action lands, so the second call can arrive a tick after `userEvent.keyboard` returns.
    await expect.poll(() => onFetch.mock.calls).toEqual([['Weather'], ['Weather']])
    await expect.element(triggerOf(screen, 'Weather')).toHaveAttribute('aria-expanded', 'false')
  })

  it('underlines the name under the pointer, rings the whole line on focus and turns the chevron when open', async () => {
    const screen = await mount(listOf({ sortable: false }))
    const line = rowOf(screen, 'Train departures').firstElementChild!
    const trigger = triggerOf(screen, 'Train departures')
    const chevron = line.querySelector(':scope > svg')!

    await userEvent.keyboard('{Tab}{Tab}{Tab}{Tab}{Tab}{Tab}{Tab}')
    await expect.element(trigger).toHaveFocus()
    await expect.poll(() => getComputedStyle(line).outlineWidth).toBe('2px')
    expect(getComputedStyle(trigger.element()).outlineStyle).toBe('none')
    expect(getComputedStyle(chevron).rotate).toBe('none')

    await trigger.hover()
    await expect.element(trigger).toHaveStyle({ textDecorationLine: 'underline' })
    await trigger.click()

    await expect.poll(() => getComputedStyle(chevron).rotate).toBe('180deg')
  })

  it.for(THEMES)('marks the Active Screen with the small red seal and hands its looks to the thumbnail, in %s', async (theme) => {
    const screen = await mount(listOf())
    await forceTheme(theme)
    const active = rowOf(screen, 'Calendar')
    const seal = active.querySelector('svg[viewBox="0 0 16 16"]:not(.icon)')!

    expect(seal.getBoundingClientRect()).toMatchObject({ width: 16, height: 16 })
    const red = elementsInSealColour(screen.container)
    expect(red).toContain(seal)
    expect(red.every(element => seal.contains(element))).toBe(true)
    await expect.element(screen.getByTestId('thumbnail-calendar')).toHaveTextContent('sealed clear')
    await expect.element(screen.getByTestId('thumbnail-weather')).toHaveTextContent('plain clear')
    await expect.element(screen.getByTestId('thumbnail-weekend')).toHaveTextContent('plain dimmed')
  })

  it('sets the Active Screen and Up next in ink and dims the name of a Screen Rotation passes over', async () => {
    const screen = await mount(listOf())
    const stateOf = (name: string, said: string) => getComputedStyle([...rowOf(screen, name).querySelectorAll('div')].find(cell => cell.textContent!.trim() === said)!)

    expect([stateOf('Calendar', 'Active Screen').color, stateOf('Calendar', 'Active Screen').fontWeight]).toEqual(['rgb(18, 18, 18)', '600'])
    expect([stateOf('Weather', 'Up next').color, stateOf('Weather', 'Up next').fontWeight]).toEqual(['rgb(18, 18, 18)', '500'])
    expect(stateOf('Weekend board', 'Schedule off').color).toBe('rgb(102, 102, 102)')
    await expect.element(triggerOf(screen, 'Weekend board')).toHaveStyle({ color: 'rgb(102, 102, 102)' })
    await expect.element(triggerOf(screen, 'Train departures')).toHaveStyle({ color: 'rgb(18, 18, 18)' })
  })

  it('words its Screen State itself unless it is given the words, and keeps the seal beside them', async () => {
    const List = defineComponent(() => () => h(ScreenRows, { items: [{ id: 'calendar', name: 'Calendar' }] }, {
      default: () => h(ScreenRow, { value: 'calendar', name: 'Calendar', state: 'active', heading: 'h4' }, { state: () => 'Active Screen, paused' }),
    }))
    const screen = await mount(List)

    await expect.element(screen.getByText('Active Screen, paused')).toBeVisible()
    expect(screen.container.querySelector('svg[viewBox="0 0 16 16"]:not(.icon)')).not.toBeNull()
    await expect.element(screen.getByRole('heading', { name: 'Calendar', level: 4 })).toBeVisible()
  })

  it('can be told that Rotation passes it over, whatever its state', async () => {
    const List = defineComponent(() => () => h(ScreenRows, { items: [{ id: 'calendar', name: 'Calendar' }] }, {
      default: () => h(ScreenRow, { value: 'calendar', name: 'Calendar', passedOver: true }, {
        thumbnail: ({ passedOver }: { passedOver: boolean }) => h('span', passedOver ? 'dimmed' : 'clear'),
      }),
    }))
    const screen = await mount(List)

    await expect.element(screen.getByRole('button', { name: 'Calendar' })).toHaveStyle({ color: 'rgb(102, 102, 102)' })
    await expect.element(screen.getByText('dimmed')).toBeVisible()
  })

  it('unfolds in 200 ms, and without any animation where motion is reduced', async () => {
    const screen = await mount(listOf())
    await triggerOf(screen, 'Calendar').click()
    const body = () => screen.getByText('Inside Calendar').element().closest('[data-state]')!

    await expect.element(screen.getByText('Inside Calendar')).toBeVisible()
    expect(getComputedStyle(body()).animationName).toBe('none')

    // Allowing motion rides a CDP session, which Firefox, running this spec for its drag coverage, has none of.
    if (!isFirefox) {
      await withMotionAllowed(async () => {
        expect(getComputedStyle(body()).animationName).not.toBe('none')
        expect(getComputedStyle(body()).animationDuration).toBe('0.2s')
      })
    }
  })

  it('has no grip, no Order and no announcements in a list that is not sortable', async () => {
    const screen = await mount(listOf({ sortable: false }))

    expect(screen.getByRole('button', { name: /^Move / }).elements()).toEqual([])
    expect(screen.getByRole('status').elements()).toEqual([])
    expect(rowOf(screen, 'Weather').textContent).not.toContain('2')
  })
})

describe('reordering screen rows', () => {
  it.for(['{Enter}', ' '])('by keyboard: %j lifts the row, the arrows move it and announce its place, and it drops', async (key) => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })
    const grip = gripOf(screen, 'Calendar')
    const region = screen.getByRole('status').element()
    expect(region).toBeEmptyDOMElement()

    await userEvent.keyboard('{Tab}')
    await expect.element(grip).toHaveFocus()
    await expect.element(grip).toHaveAccessibleDescription(/Space or Enter lifts the row/)
    await expect.element(grip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.keyboard(key)

    await expect.element(grip).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => getComputedStyle(rowOf(screen, 'Calendar')).backgroundColor).toBe('rgb(241, 241, 241)')
    expect([getComputedStyle(rowOf(screen, 'Calendar')).outlineWidth, getComputedStyle(rowOf(screen, 'Calendar')).outlineColor]).toEqual(['1px', 'rgb(18, 18, 18)'])

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 2 of 4')
    expect(namesOf(screen)).toEqual(['Weather', 'Calendar', 'Weekend board', 'Train departures'])
    await expect.element(grip).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 3 of 4')
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 2 of 4')
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 3 of 4')
    expect(screen.getByRole('status').element()).toBe(region)
    expect(onReorder).not.toHaveBeenCalled()

    await userEvent.keyboard(key)

    // Same Firefox keyboard-automation lag as above: the drop's `reorder` can land a tick late.
    await expect.poll(() => onReorder.mock.calls).toEqual([[['weather', 'weekend', 'calendar', 'trains']]])
    await expect.element(grip).toHaveAttribute('aria-pressed', 'false')
    await expect.element(grip).toHaveFocus()
    expect(namesOf(screen)).toEqual(['Weather', 'Weekend board', 'Calendar', 'Train departures'])
    expect(rowOf(screen, 'Calendar').textContent).toContain('3')
    await expect.poll(() => getComputedStyle(rowOf(screen, 'Calendar')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('by keyboard: Escape puts the row back and says so, and nothing is emitted', async () => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })

    await userEvent.keyboard('{Tab}{Enter}{ArrowDown}{ArrowDown}')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 3 of 4')
    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 1 of 4')
    expect(namesOf(screen)).toEqual(NAMES)
    await expect.element(gripOf(screen, 'Calendar')).toHaveAttribute('aria-pressed', 'false')
    await expect.element(gripOf(screen, 'Calendar')).toHaveFocus()
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('by keyboard: a row stops at the ends of the list, and one dropped where it was lifted is not a new order', async () => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })

    await userEvent.keyboard('{Tab}{Enter}{ArrowUp}')
    expect(namesOf(screen)).toEqual(NAMES)
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement()
    await userEvent.keyboard('{Enter}')

    await expect.element(gripOf(screen, 'Calendar')).toHaveAttribute('aria-pressed', 'false')
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('by keyboard: the arrows do nothing to a row that is not lifted', async () => {
    const screen = await mount(listOf())

    await userEvent.keyboard('{Tab}{ArrowDown}')

    expect(namesOf(screen)).toEqual(NAMES)
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('by keyboard: leaving the grip of a lifted row puts it back', async () => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })

    await userEvent.keyboard('{Tab}{Enter}{ArrowDown}')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 2 of 4')
    await userEvent.keyboard('{Tab}')

    await expect.poll(() => namesOf(screen)).toEqual(NAMES)
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 1 of 4')
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('by pointer: a row dragged by its grip lands after the row it is dropped on the lower half of', async () => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })

    await userEvent.dragAndDrop(gripOf(screen, 'Calendar'), screen.getByTestId('thumbnail-weekend'), {
      targetPosition: { x: 4, y: screen.getByTestId('thumbnail-weekend').element().getBoundingClientRect().height - 1 },
    })

    await expect.poll(() => onReorder.mock.calls).toEqual([[['weather', 'weekend', 'calendar', 'trains']]])
    expect(namesOf(screen)).toEqual(['Weather', 'Weekend board', 'Calendar', 'Train departures'])
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 3 of 4')
    await expect.poll(() => getComputedStyle(rowOf(screen, 'Calendar')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('by pointer: a row dropped on the upper half of another lands before it', async () => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })

    await userEvent.dragAndDrop(gripOf(screen, 'Train departures'), screen.getByTestId('thumbnail-calendar'), {
      targetPosition: { x: 4, y: 1 },
    })

    await expect.poll(() => onReorder.mock.calls).toEqual([[['trains', 'calendar', 'weather', 'weekend']]])
    await expect.element(screen.getByRole('status')).toHaveTextContent('Train departures, Order 1 of 4')
  })

  it('by pointer: a row dropped where it already stands is not a new order', async () => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })

    await userEvent.dragAndDrop(gripOf(screen, 'Weather'), screen.getByTestId('thumbnail-calendar'), {
      targetPosition: { x: 4, y: screen.getByTestId('thumbnail-calendar').element().getBoundingClientRect().height - 1 },
    })

    await expect.poll(() => getComputedStyle(rowOf(screen, 'Weather')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(onReorder).not.toHaveBeenCalled()
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('by pointer: the page scrolls while a lifted row is held near its edge', async () => {
    const many = Array.from({ length: 40 }, (_, index) => buildScreen({ id: `screen-${index}`, name: `Screen ${index + 1}` }))
    const screen = await mount(listOf({ screens: many }))
    const grip = gripOf(screen, 'Screen 1').element()
    const row = rowOf(screen, 'Screen 1')
    const nearTheBottom = { clientX: 40, clientY: window.innerHeight - 4, bubbles: true, cancelable: true }
    expect(window.scrollY).toBe(0)

    // The row, not the grip, is the `draggable` element (the grip is only its `dragHandle`), so a real
    // drag's `dragstart` targets the row, over a point inside the grip, which the handle check reads.
    const gripRect = grip.getBoundingClientRect()
    row.dispatchEvent(new DragEvent('dragstart', { ...nearTheBottom, clientX: gripRect.left + 4, clientY: gripRect.top + 4, dataTransfer: new DataTransfer() }))
    try {
      await expect.poll(() => {
        document.body.dispatchEvent(new DragEvent('dragover', { ...nearTheBottom, dataTransfer: new DataTransfer() }))
        return window.scrollY
      }).toBeGreaterThan(0)
    }
    finally {
      row.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
      window.scrollTo(0, 0)
    }
  })

  it('draws the lifted row on wash in a 1 px ink outline, and a 2 px ink line where it will land', async () => {
    const screen = await mount(listOf({ force: { lifted: 'weather', dropBefore: 'calendar', dropAfter: 'trains' } }))
    const style = (name: string) => getComputedStyle(rowOf(screen, name))

    await expect.poll(() => style('Weather').backgroundColor).toBe('rgb(241, 241, 241)')
    expect([style('Weather').outlineWidth, style('Weather').outlineStyle, style('Weather').outlineColor]).toEqual(['1px', 'solid', 'rgb(18, 18, 18)'])
    expect(style('Calendar').boxShadow).toBe('rgb(18, 18, 18) 0px -2px 0px 0px')
    expect(style('Train departures').boxShadow).toBe('rgb(18, 18, 18) 0px 2px 0px 0px')
    expect(style('Weekend board').boxShadow).toBe('none')
    expect(elementsInSealColour(rowOf(screen, 'Weather'))).toEqual([])
  })

  it('on phone: two buttons take the grip\'s place, move the row a place and announce it', async () => {
    const onReorder = vi.fn()
    const screen = await mount(listOf(), { props: { onReorder } })

    await expect.element(screen.getByRole('button', { name: 'Move Weather earlier in the Order' })).not.toBeInTheDocument()

    await onPhone(async () => {
      await expect.element(gripOf(screen, 'Weather')).not.toBeInTheDocument()
      const later = screen.getByRole('button', { name: 'Move Weather later in the Order' })

      await later.click()

      expect(onReorder.mock.calls).toEqual([[['calendar', 'weekend', 'weather', 'trains']]])
      await expect.element(screen.getByRole('status')).toHaveTextContent('Weather, Order 3 of 4')
      expect(namesOf(screen)).toEqual(['Calendar', 'Weekend board', 'Weather', 'Train departures'])
      await expect.element(later).toHaveFocus()

      await screen.getByRole('button', { name: 'Move Weather earlier in the Order' }).click()

      expect(onReorder.mock.calls[1]).toEqual([['calendar', 'weather', 'weekend', 'trains']])
      await expect.element(screen.getByRole('status')).toHaveTextContent('Weather, Order 2 of 4')
      await expect.element(triggerOf(screen, 'Weather')).toHaveAttribute('aria-expanded', 'false')
    })
  })

  it('on phone: the first row cannot move earlier nor the last one later, and the focus goes to the button that still works', async () => {
    const screen = await mount(listOf())

    await onPhone(async () => {
      await expect.element(screen.getByRole('button', { name: 'Move Calendar earlier in the Order' })).toBeDisabled()
      await expect.element(screen.getByRole('button', { name: 'Move Train departures later in the Order' })).toBeDisabled()

      await screen.getByRole('button', { name: 'Move Weather earlier in the Order' }).click()

      await expect.element(screen.getByRole('button', { name: 'Move Weather earlier in the Order' })).toBeDisabled()
      await expect.element(screen.getByRole('button', { name: 'Move Weather later in the Order' })).toHaveFocus()
    })
  })

  it('puts the rows back when its owner reports that the save was rejected', async () => {
    let reject!: (reason: Error) => void
    const save = vi.fn(() => new Promise<void>((_, rejected) => {
      reject = rejected
    }))
    const screen = await mount(listOf({ save }))

    await userEvent.keyboard('{Tab}{Enter}{ArrowDown}{Enter}')
    await expect.poll(() => namesOf(screen)).toEqual(['Weather', 'Calendar', 'Weekend board', 'Train departures'])
    expect(save).toHaveBeenCalledWith(['weather', 'calendar', 'weekend', 'trains'])

    reject(new Error('Kuroshiro\'s server is not answering.'))

    await expect.poll(() => namesOf(screen)).toEqual(NAMES)
    expect(rowOf(screen, 'Calendar').textContent).toContain('1')
    await expect.element(gripOf(screen, 'Calendar')).toHaveAttribute('aria-pressed', 'false')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 1 of 4')
  })

  it('announces the same move again when it is made again after the rows were put back', async () => {
    const save = vi.fn(() => Promise.reject(new Error('Kuroshiro\'s server is not answering.')))
    const screen = await mount(listOf({ save }))

    await userEvent.keyboard('{Tab}{Enter}{ArrowDown}{Enter}')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 1 of 4')
    await expect.poll(() => namesOf(screen)).toEqual(NAMES)
    await userEvent.keyboard('{Enter}{ArrowDown}')

    await expect.element(screen.getByRole('status')).toHaveTextContent('Calendar, Order 2 of 4')
  })

  // Touch emulation rides a CDP session, which Firefox, running this spec for its drag coverage, has none of.
  it.skipIf(isFirefox)('has 44 px targets at a coarse pointer: the line, the grip and the move buttons', async () => {
    const screen = await mount(listOf({ sortable: true }))
    const grip = gripOf(screen, 'Train departures').element()

    await withCoarsePointer(async () => {
      expect(rowOf(screen, 'Train departures').firstElementChild!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      expect(grip.getBoundingClientRect().height).toBe(44)
      expect(Number.parseFloat(getComputedStyle(grip, '::before').width)).toBe(44)
      await onPhone(async () => {
        const later = screen.getByRole('button', { name: 'Move Calendar later in the Order' }).element().getBoundingClientRect()
        expect([later.width, later.height]).toEqual([44, 44])
      })
    })
  })

  it('gives the place of the name and the kind to what `#rename` holds while it is renamed, and keeps the opened row\'s name', async () => {
    const renaming = ref(false)
    const screen = await mount(defineComponent(() => () => h(ScreenRows<ScreenRead>, { items: SCREENS.slice(0, 1), open: 'calendar' }, {
      default: ({ item }: { item: ScreenRead }) => h(ScreenRow, { value: item.id, name: item.name, kind: 'Plugin', renaming: renaming.value }, {
        rename: () => h('input', { 'aria-label': 'Name of Calendar' }),
        default: () => h('p', 'Inside Calendar'),
      }),
    })))
    const input = screen.getByRole('textbox', { name: 'Name of Calendar' })

    await expect.element(triggerOf(screen, 'Calendar')).toBeVisible()
    expect(screen.container.querySelector('input')!.checkVisibility()).toBe(false)
    await expect.element(screen.getByText('Plugin')).toBeVisible()

    renaming.value = true

    await expect.element(input).toBeVisible()
    await expect.poll(() => screen.container.querySelector('h3')!.checkVisibility()).toBe(false)
    await expect.element(screen.getByText('Plugin')).not.toBeVisible()
    await expect.element(screen.getByRole('region', { name: 'Calendar' })).toBeVisible()
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(ScreenRowGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
