import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { arrived } from '@/testing/arrivals'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import PreviewPlateGallery from '../PreviewPlate.gallery.vue'
import PreviewPlate from '../PreviewPlate.vue'

type Screen = Awaited<ReturnType<typeof mount>>

const NAME = 'Preview of Weather'
const documentSaying = (text: string) => `<!doctype html><html><body style="margin:0">${text}</body></html>`
const OG = { name: NAME, width: 800, height: 480 }

const framesOf = (screen: Screen) => [...screen.container.querySelectorAll('iframe')]
const plateOf = (screen: Screen) => screen.getByRole('group', { name: NAME }).element()

async function mountDrawn(props: Record<string, unknown> = {}) {
  const screen = await mount(PreviewPlate, { props: { ...OG, document: documentSaying('first'), ...props } })
  await expect.poll(() => framesOf(screen).map(frame => getComputedStyle(frame).visibility)).toEqual(['visible'])
  return screen
}

describe('preview plate', () => {
  it('draws the document in a frame that may run scripts and nothing else', async () => {
    const screen = await mountDrawn()
    const [frame] = framesOf(screen)

    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.srcdoc).toBe(documentSaying('first'))
    expect(frame.title).toBe(NAME)
    expect(frame.tabIndex).toBe(-1)
  })

  it('is the hero plate: a 2 px ink outline on the plate ground in both themes', async () => {
    const screen = await mount(PreviewPlate, { props: { ...OG, document: documentSaying('first') }, theme: 'dark' })
    const plate = plateOf(screen)

    expect(getComputedStyle(plate).backgroundColor).toBe('rgb(255, 255, 255)')
    expect(getComputedStyle(plate).outlineWidth).toBe('2px')
    expect(getComputedStyle(plate).outlineColor).toBe('rgb(244, 244, 244)')
    expect(getComputedStyle(framesOf(screen)[0]).backgroundColor).toBe('rgb(255, 255, 255)')
  })

  it.for([
    { width: 800, height: 480 },
    { width: 1872, height: 1404 },
  ])('lays a $width by $height document out at its own pixels and scales it to the plate, without scrollbars', async ({ width, height }) => {
    const stage = await mount(PreviewPlate, { props: { name: NAME, document: documentSaying('x'), width, height }, attrs: { style: 'width: 400px' } })
    const plate = plateOf(stage)
    const frame = framesOf(stage)[0]

    expect(plate.getBoundingClientRect().width).toBe(400)
    expect(plate.getBoundingClientRect().height).toBeCloseTo(400 * height / width, 0)
    expect([frame.clientWidth, frame.clientHeight]).toEqual([width, height])
    await expect.poll(() => frame.getBoundingClientRect().width).toBeCloseTo(400, 1)
    expect(frame.getBoundingClientRect().height).toBeCloseTo(400 * height / width, 0)
    const drawing = frame.parentElement!
    expect(getComputedStyle(drawing).overflow).toBe('hidden')
    expect([drawing.clientWidth, drawing.clientHeight]).toEqual([plate.clientWidth, plate.clientHeight])
  })

  it('follows the width of its place', async () => {
    const screen = await mountDrawn()
    const frame = framesOf(screen)[0]

    screen.container.style.width = '320px'

    await expect.poll(() => frame.getBoundingClientRect().width).toBeCloseTo(320, 1)
  })

  it('keeps the old drawing until the new document has loaded', async () => {
    const screen = await mountDrawn()

    await screen.rerender({ document: documentSaying('second') })

    expect(framesOf(screen).map(frame => [frame.srcdoc, getComputedStyle(frame).visibility])).toEqual([
      [documentSaying('first'), 'visible'],
      [documentSaying('second'), 'hidden'],
    ])
    expect(screen.container.querySelector('[aria-busy="true"]')).not.toBeNull()
    await expect.poll(() => framesOf(screen).map(frame => [frame.srcdoc, getComputedStyle(frame).visibility]))
      .toEqual([[documentSaying('second'), 'visible']])
    expect(screen.container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('draws only the newest of several documents that came while one was loading', async () => {
    const screen = await mountDrawn()

    await screen.rerender({ document: documentSaying('second') })
    await screen.rerender({ document: documentSaying('third') })

    expect(framesOf(screen).map(frame => frame.srcdoc)).toEqual([documentSaying('first'), documentSaying('third')])
    await expect.poll(() => framesOf(screen).map(frame => frame.srcdoc)).toEqual([documentSaying('third')])
  })

  it('keeps the last drawing at 40% under a note when the next one could not be made', async () => {
    const screen = await mountDrawn()

    await screen.rerender({ notDrawn: true })

    await expect.element(screen.getByText('Not drawn. This is the last drawing.')).toBeVisible()
    await expect.poll(() => getComputedStyle(framesOf(screen)[0]).opacity).toBe('0.4')
    const note = screen.getByText('Not drawn. This is the last drawing.').element().getBoundingClientRect()
    const plate = plateOf(screen).getBoundingClientRect()
    expect(note.left - plate.left).toBe(12)
    expect(plate.bottom - note.bottom).toBe(12)
  })

  it('is empty under the note "Not drawn." when there is no earlier drawing', async () => {
    const screen = await mount(PreviewPlate, { props: { ...OG, document: null, notDrawn: true } })

    await expect.element(screen.getByText('Not drawn.', { exact: true })).toBeVisible()
    expect(framesOf(screen)).toEqual([])
  })

  it('shows the dither while it is rendering, with a note of what it waits for', async () => {
    const screen = await mount(PreviewPlate, { props: { ...OG, document: null, rendering: true } })
    await expect.element(screen.getByRole('img', { name: `${NAME}: rendering` })).toBeVisible()
    await expect.element(screen.getByText('Rendering')).toBeVisible()

    await screen.rerender({ renderingNote: 'Fetching the data' })

    await expect.element(screen.getByRole('img', { name: `${NAME}: fetching the data` })).toBeVisible()
    await expect.element(screen.getByText('Fetching the data')).toBeVisible()
    expect(framesOf(screen)).toEqual([])
  })

  it('draws once the data it waited for is there', async () => {
    const screen = await mount(PreviewPlate, { props: { ...OG, document: documentSaying('first'), rendering: true } })
    expect(framesOf(screen)).toEqual([])

    await screen.rerender({ rendering: false })

    await expect.poll(() => framesOf(screen).map(frame => getComputedStyle(frame).visibility)).toEqual(['visible'])
  })

  it('is accessible and does not overflow in every state', async () => {
    const screen = await mount(PreviewPlateGallery)
    await arrived(screen.container)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
