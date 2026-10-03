import { beforeEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import CodeBlockGallery from '../CodeBlock.gallery.vue'
import CodeBlock from '../CodeBlock.vue'

const COMMAND = `curl -X POST http://kuroshiro.lan:3000/api/webhooks/… \\\n  -d '{"temperature": 21.4}'`
const FORTY_LINES = Array.from({ length: 40 }, (_, index) => `"line ${index + 1}"`).join('\n')

const preOf = (container: Element) => container.querySelector('pre')!

// Spec files run side by side and share one clipboard, which CopyValue.spec.ts reads back. So what is written is observed here, at the browser's own function, and kept off the clipboard.
const written = vi.fn<Clipboard['writeText']>(async () => {})

beforeEach(() => {
  written.mockClear()
  const spy = vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(written)
  return () => spy.mockRestore()
})

describe('code block', () => {
  it('shows the code as it is written, in mono on the wash ground', async () => {
    const screen = await mount(CodeBlock, { props: { code: COMMAND } })
    const pre = preOf(screen.container)

    expect(pre.textContent).toBe(COMMAND)
    expect(getComputedStyle(pre).whiteSpace).toBe('pre')
    expect(getComputedStyle(pre).fontFamily).toContain('JetBrains Mono')
    expect(getComputedStyle(pre.parentElement!).backgroundColor).toBe('rgb(241, 241, 241)')
    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('has no button unless it is asked for one', async () => {
    const screen = await mount(CodeBlock, { props: { code: COMMAND } })

    expect(screen.getByRole('button').elements()).toEqual([])
    expect(screen.getByRole('status').elements()).toEqual([])
  })

  it('scrolls a long line inside itself, where the keyboard can reach it', async () => {
    const screen = await mount(CodeBlock, { props: { code: 'x'.repeat(2000) } })
    const pre = preOf(screen.container)

    expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth)
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth)
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement).toBe(pre)
  })

  it('"Copy" writes the code to the clipboard, then shows and announces "Copied"', async () => {
    const screen = await mount(CodeBlock, { props: { code: COMMAND, copy: true } })
    const region = screen.getByRole('status').element()
    expect(region).toBeEmptyDOMElement()

    await screen.getByRole('button', { name: 'Copy' }).click()

    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible()
    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(screen.getByRole('status').element()).toBe(region)
    expect(written.mock.calls).toEqual([[COMMAND]])
  })

  it('copies by keyboard', async () => {
    const screen = await mount(CodeBlock, { props: { code: 'kuro-0042', copy: true } })

    await userEvent.keyboard('{Tab}{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Copy' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(written.mock.calls).toEqual([['kuro-0042']])
  })

  it('copies the working command when it shows less of it', async () => {
    const working = COMMAND.replace('…', 'whk_9f2c41d07ab35e68')
    const screen = await mount(CodeBlock, { props: { code: COMMAND, copyValue: working, copy: true } })

    await screen.getByRole('button', { name: 'Copy' }).click()

    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(written.mock.calls).toEqual([[working]])
    expect(preOf(screen.container).textContent).toBe(COMMAND)
  })

  it('folds a block longer than asked to its first lines, and still copies all of it', async () => {
    const screen = await mount(CodeBlock, { props: { code: FORTY_LINES, foldAfter: 30, copy: true } })

    expect(preOf(screen.container).textContent!.split('\n')).toHaveLength(30)
    expect(preOf(screen.container).textContent).toContain('"line 30"')
    await expect.element(screen.getByRole('button', { name: 'Show all 40 lines' })).toHaveAttribute('aria-expanded', 'false')

    await screen.getByRole('button', { name: 'Copy' }).click()
    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(written.mock.calls).toEqual([[FORTY_LINES]])
  })

  it.for(['{Enter}', ' '])('unfolds and folds again by keyboard, with %j', async (key) => {
    const screen = await mount(CodeBlock, { props: { code: FORTY_LINES, foldAfter: 30 } })

    await userEvent.keyboard('{Tab}{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Show all 40 lines' })).toHaveFocus()
    await userEvent.keyboard(key)

    await expect.element(screen.getByRole('button', { name: 'Show the first 30 lines' })).toHaveFocus()
    await expect.element(screen.getByRole('button', { name: 'Show the first 30 lines' })).toHaveAttribute('aria-expanded', 'true')
    expect(preOf(screen.container).textContent).toBe(FORTY_LINES)

    await userEvent.keyboard(key)

    await expect.element(screen.getByRole('button', { name: 'Show all 40 lines' })).toHaveFocus()
    expect(preOf(screen.container).textContent!.split('\n')).toHaveLength(30)
  })

  it('does not fold a block that is short enough', async () => {
    const screen = await mount(CodeBlock, { props: { code: FORTY_LINES, foldAfter: 40 } })

    expect(preOf(screen.container).textContent).toBe(FORTY_LINES)
    expect(screen.getByRole('button').elements()).toEqual([])
  })

  it('has 44 px buttons at a coarse pointer', async () => {
    const screen = await mount(CodeBlock, { props: { code: FORTY_LINES, foldAfter: 30, copy: true } })

    await withCoarsePointer(async () => {
      expect(screen.getByRole('button').elements().map(button => button.getBoundingClientRect().height)).toEqual([44, 44])
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(CodeBlockGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
