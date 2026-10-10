import type { CodeEditorMode, CodeValidity } from '../codeEditor'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { arrived } from '@/testing/arrivals'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import CodeEditorGallery from '../CodeEditor.gallery.vue'
import CodeEditor from '../CodeEditor.vue'

type Screen = Awaited<ReturnType<typeof mount>>

const NAME = 'Template of Weather, Full'
const INK = 'rgb(18, 18, 18)'

const DATA = {
  location: 'Lindenplatz',
  forecast: {
    current: { temperature: 14.3, summary: 'Rain from 15:00' },
    hourly: [{ time: 12 }, { time: 13 }, { time: 14 }],
  },
}

async function mountEditor(props: Record<string, unknown> = {}) {
  const onUpdate = vi.fn<(text: string) => void>()
  const screen = await mount(CodeEditor, {
    props: { 'modelValue': '', 'mode': 'liquid' as CodeEditorMode, 'aria-label': NAME, 'onUpdate:modelValue': onUpdate, ...props },
  })
  onUpdate.mockImplementation(text => screen.rerender({ modelValue: text }))
  const editor = screen.getByRole('textbox', { name: NAME })
  await expect.element(editor).toBeVisible()
  return { screen, editor, onUpdate }
}

/** Mounts an editor with the focus in it and the cursor at the end of its text. */
async function mountFocused(props: Record<string, unknown> = {}) {
  const mounted = await mountEditor(props)
  await userEvent.keyboard('{Tab}{Control>}{End}{/Control}')
  await expect.element(mounted.editor).toHaveFocus()
  return mounted
}

const pressed = (keys: string) => userEvent.keyboard(keys)
const lastTextOf = (onUpdate: ReturnType<typeof vi.fn>) => onUpdate.mock.lastCall?.[0]

function completionsOf(screen: Screen) {
  return [...screen.baseElement.querySelectorAll('.cm-tooltip-autocomplete li')].map(option => [
    option.querySelector('.cm-completionLabel')?.textContent,
    option.querySelector('.cm-completionDetail')?.textContent,
  ].filter(Boolean).join(' · '))
}

/**
 * Answers a reader, not a list: the editor also completes while typing, so the list on show
 * may still be the one of an earlier keystroke. Callers poll the reader for what they expect.
 */
async function completionsAfter(typed: string, props: Record<string, unknown> = {}) {
  const { screen } = await mountFocused({ completionData: DATA, kuroshiroFilters: ['date_short', 'yesno'], ...props })
  await pressed(typed)
  await pressed('{Control>} {/Control}')
  return () => completionsOf(screen)
}

const codeOf = (screen: Screen) => [...screen.container.querySelectorAll('.cm-line')].map(line => line.textContent).join('\n')
const frameOf = (screen: Screen) => screen.container.querySelector<HTMLElement>('.code-editor')!
const currentLineOf = (screen: Screen) => screen.container.querySelector('.cm-activeLineGutter')?.textContent

describe('code editor: typing', () => {
  it('takes what is typed and emits the text', async () => {
    const { editor, onUpdate } = await mountEditor()

    await editor.click()
    await pressed('Hello')

    expect(lastTextOf(onUpdate)).toBe('Hello')
    await expect.element(editor).toHaveTextContent('Hello')
  })

  it('shows a text the caller sets without emitting it back', async () => {
    const { screen, editor, onUpdate } = await mountEditor({ modelValue: 'first' })

    await screen.rerender({ modelValue: 'second' })

    await expect.element(editor).toHaveTextContent('second')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('indents with Tab and outdents with Shift Tab, by two spaces', async () => {
    const { onUpdate } = await mountFocused({ modelValue: '<p>' })

    await pressed('{Tab}')
    expect(lastTextOf(onUpdate)).toBe('  <p>')

    await pressed('{Shift>}{Tab}{/Shift}')
    expect(lastTextOf(onUpdate)).toBe('<p>')
  })

  it('lets the focus move on with Esc, then Tab', async () => {
    const after = defineComponent(() => () => h('div', [
      h(CodeEditor, { 'modelValue': '<p>', 'mode': 'html', 'aria-label': NAME }),
      h('button', 'Save HTML'),
    ]))
    const screen = await mount(after)
    await expect.element(screen.getByRole('textbox', { name: NAME })).toBeVisible()
    await pressed('{Tab}')
    await expect.element(screen.getByRole('textbox', { name: NAME })).toHaveFocus()

    await pressed('{Escape}{Tab}')

    await expect.element(screen.getByRole('button', { name: 'Save HTML' })).toHaveFocus()
    await expect.poll(() => codeOf(screen)).toBe('<p>')
  })

  it('says in its strip how to indent and how to move on, and which mode it is in', async () => {
    const { screen } = await mountEditor()

    await expect.element(screen.getByText('Tab indents. Esc then Tab moves on.')).toBeVisible()
    await expect.element(screen.getByText('Liquid and HTML')).toBeVisible()
  })

  it('calls the save handler on Ctrl S and holds back the browser\'s own save', async () => {
    const onSave = vi.fn()
    const browserSaw = vi.fn<(prevented: boolean) => void>()
    const listen = (event: KeyboardEvent) => event.key === 's' && browserSaw(event.defaultPrevented)
    window.addEventListener('keydown', listen)
    await mountFocused({ onSave })

    await pressed('{Control>}s{/Control}')
    window.removeEventListener('keydown', listen)

    expect(onSave).toHaveBeenCalledOnce()
    expect(browserSaw.mock.calls).toEqual([[true]])
  })

  it('opens search and replace at its top on Ctrl F', async () => {
    const { screen } = await mountFocused({ modelValue: 'one two one' })

    await pressed('{Control>}f{/Control}')

    await expect.element(screen.getByRole('textbox', { name: 'Find' })).toHaveFocus()
    await expect.element(screen.getByRole('textbox', { name: 'Replace' })).toBeVisible()
    const panel = screen.container.querySelector('.cm-panels-top')!
    expect(panel.getBoundingClientRect().top).toBeLessThan(screen.container.querySelector('.cm-scroller')!.getBoundingClientRect().top)
  })

  it('undoes with Ctrl Z and redoes with Ctrl Shift Z', async () => {
    const { onUpdate } = await mountFocused({ modelValue: 'kept' })

    await pressed(' typed')
    expect(lastTextOf(onUpdate)).toBe('kept typed')

    await pressed('{Control>}z{/Control}')
    expect(lastTextOf(onUpdate)).toBe('kept')

    await pressed('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(lastTextOf(onUpdate)).toBe('kept typed')
  })

  it.for([
    { what: 'a bracket', typed: '(', text: '()' },
    { what: 'a quote', typed: '"', text: '""' },
    { what: 'an HTML tag', typed: '<div>', text: '<div></div>' },
    { what: 'a Liquid tag', typed: '{{%', text: '{%%}' },
    { what: 'a Liquid output', typed: '{{{{', text: '{{}}' },
  ])('closes $what by itself', async ({ typed, text }) => {
    const { onUpdate } = await mountFocused()

    await pressed(typed)

    expect(lastTextOf(onUpdate)).toBe(text)
  })

  it('puts what is typed after {% between the two percent signs', async () => {
    const { onUpdate } = await mountFocused()

    await pressed('{{% if wind ')

    expect(lastTextOf(onUpdate)).toBe('{% if wind %}')
  })

  it('wraps a long line instead of scrolling sideways', async () => {
    const { screen } = await mountEditor({ modelValue: 'word '.repeat(4000) })
    const scroller = screen.container.querySelector('.cm-scroller')!

    expect(scroller.scrollWidth).toBe(scroller.clientWidth)
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  })

  it('does not change a read-only text', async () => {
    const { screen, editor, onUpdate } = await mountFocused({ modelValue: 'removed', readOnly: true, stripNote: 'This template is removed when you save.' })

    await pressed('more')

    expect(onUpdate).not.toHaveBeenCalled()
    await expect.element(editor).toHaveAttribute('aria-readonly', 'true')
    await expect.poll(() => codeOf(screen)).toBe('removed')
  })

  it('says its strip note in place of the hint', async () => {
    const { screen } = await mountEditor({ stripNote: 'This template is removed when you save.' })

    await expect.element(screen.getByText('This template is removed when you save.')).toBeVisible()
    expect(screen.getByText('moves on').elements()).toEqual([])
  })

  it('emits blur when the focus leaves it, and not when it moves to its own search', async () => {
    const onBlur = vi.fn()
    await mountFocused({ onBlur })

    await pressed('{Control>}f{/Control}')
    expect(onBlur).not.toHaveBeenCalled()

    await pressed('{Escape}{Escape}{Tab}')
    await expect.poll(() => onBlur.mock.calls.length).toBe(1)
  })
})

describe('code editor: completion', () => {
  it('offers the names of the data with their kinds inside {{ }}', async () => {
    await expect.poll(await completionsAfter('{{{{ ')).toEqual(expect.arrayContaining(['location · string', 'forecast · object']))
  })

  it('offers the keys under a path after a dot', async () => {
    await expect.poll(await completionsAfter('{{{{ forecast.current.')).toEqual(['summary · string', 'temperature · number'])
  })

  it('offers first, last and size for a list', async () => {
    await expect.poll(await completionsAfter('{{{{ forecast.hourly.')).toEqual(['first', 'last', 'size'])
  })

  it('offers Liquid\'s filters after a pipe and marks the given ones "Kuroshiro"', async () => {
    const offered = await completionsAfter('{{{{ location | ')

    await expect.poll(offered).toEqual(expect.arrayContaining(['date_short · Kuroshiro', 'yesno · Kuroshiro', 'upcase', 'default']))
    expect(offered().filter(filter => filter.endsWith('Kuroshiro'))).toHaveLength(2)
  })

  it('offers Liquid\'s tags after {%', async () => {
    await expect.poll(await completionsAfter('{{% ')).toEqual(expect.arrayContaining(['if', 'for', 'assign']))
  })

  it('offers the names inside a tag too', async () => {
    await expect.poll(await completionsAfter('{{% if ')).toEqual(expect.arrayContaining(['location · string']))
  })

  it('offers HTML\'s own tags in the HTML mode, and none of the data', async () => {
    const offered = await completionsAfter('<', { mode: 'html' })

    await expect.poll(offered).toEqual(expect.arrayContaining(['div', 'span']))
    expect(offered().join(' ')).not.toContain('forecast')
  })

  it('offers nothing of Liquid in the HTML mode', async () => {
    const { screen } = await mountFocused({ mode: 'html', completionData: DATA, kuroshiroFilters: ['yesno'] })

    await pressed('{{{{ location | ')
    await pressed('{Control>} {/Control}')

    await new Promise(resolve => setTimeout(resolve, 300))

    expect(completionsOf(screen).join(' ')).not.toMatch(/forecast|yesno|upcase/)
  })

  it('offers only the language\'s keywords in JavaScript', async () => {
    const offered = await completionsAfter('function transform(input) {{ retu', { mode: 'javascript', size: 'code-input' })

    await expect.poll(offered).toEqual(['return'])
  })

  it('offers nothing in JavaScript for a name of the code', async () => {
    const { screen } = await mountFocused({ mode: 'javascript', size: 'code-input', modelValue: 'const hours = 1\n' })

    await pressed('hou')
    await pressed('{Control>} {/Control}')
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(completionsOf(screen)).toEqual([])
  })

  it('offers nothing in JSON', async () => {
    const { screen } = await mountFocused({ mode: 'json', size: 'code-input' })

    await pressed('{{"Acc')
    await pressed('{Control>} {/Control}')
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(completionsOf(screen)).toEqual([])
  })
})

describe('code editor: problems', () => {
  const TEMPLATE = '<div>\n  {{ location }}\n  {% for hour in forecast.hourly %}\n</div>'
  const PROBLEM = { line: 3, message: 'tag {% for hour in forecast.hourly %} not closed' }

  it('marks a given problem in the code, the gutter and the strip', async () => {
    const { screen } = await mountEditor({ modelValue: TEMPLATE, problem: PROBLEM })
    const marked = () => screen.container.querySelector<HTMLElement>('.cm-lintRange-error')!
    // The gutter keeps a hidden copy of its widest marker to hold its width; the one on the line comes after it.
    const marker = () => [...screen.container.querySelectorAll<HTMLElement>('.cm-lint-marker-error')].at(-1)!
    const lineHeights = () => [...screen.container.querySelectorAll('.cm-line')].map(line => Math.round(line.getBoundingClientRect().height))

    expect(marked().textContent).toBe('{% for hour in forecast.hourly %}')
    expect(getComputedStyle(marked()).textDecorationStyle).toBe('double')
    expect(getComputedStyle(marked()).textDecorationColor).toBe(INK)
    expect(getComputedStyle(marker()).backgroundColor).toBe(INK)
    await expect.poll(() => Math.abs(marker().getBoundingClientRect().top - marked().getBoundingClientRect().top)).toBeLessThan(5)
    expect(lineHeights()).toEqual([20, 20, 20, 20])
    await expect.element(screen.getByRole('status')).toHaveTextContent('Line 3: tag {% for hour in forecast.hourly %} not closed')
    expect(screen.getByText('moves on').elements()).toEqual([])
  })

  it('narrows the mark to a given range', async () => {
    const from = TEMPLATE.indexOf('for hour')
    const { screen } = await mountEditor({ modelValue: TEMPLATE, problem: { ...PROBLEM, from, to: from + 3 } })

    expect(screen.container.querySelector('.cm-lintRange-error')!.textContent).toBe('for')
  })

  it('shows the message when the marked place is hovered', async () => {
    const { screen } = await mountEditor({ modelValue: TEMPLATE, problem: PROBLEM })

    await userEvent.hover(screen.container.querySelector('.cm-lintRange-error')!)

    await expect.poll(() => screen.baseElement.querySelector('.cm-tooltip-lint')?.textContent).toBe(PROBLEM.message)
    expect(getComputedStyle(screen.baseElement.querySelector('.cm-diagnostic')!).borderLeftStyle).toBe('none')
    expect(getComputedStyle(screen.baseElement.querySelector('.cm-tooltip-lint')!).borderColor).toBe(INK)
  })

  it('shows the message when the icon in the gutter is hovered', async () => {
    const { screen } = await mountEditor({ modelValue: TEMPLATE, problem: PROBLEM })

    await userEvent.hover([...screen.container.querySelectorAll('.cm-lint-marker-error')].at(-1)!)

    await expect.poll(() => screen.baseElement.querySelector('.cm-tooltip-lint')?.textContent).toBe(PROBLEM.message)
  })

  it('puts the cursor at the line with "Go to line"', async () => {
    const { screen, editor } = await mountEditor({ modelValue: TEMPLATE, problem: PROBLEM })

    await screen.getByRole('button', { name: 'Go to line 3' }).click()

    await expect.element(editor).toHaveFocus()
    expect(currentLineOf(screen)).toBe('3')
  })

  it('restores the hint when the problem is cleared', async () => {
    const { screen } = await mountEditor({ modelValue: TEMPLATE, problem: PROBLEM })
    const region = screen.getByRole('status').element()

    await screen.rerender({ problem: null })

    await expect.element(screen.getByText('Tab indents. Esc then Tab moves on.')).toBeVisible()
    expect(screen.getByRole('status').element()).toBe(region)
    expect(region).toBeEmptyDOMElement()
    expect(screen.getByRole('button').elements()).toEqual([])
    expect(screen.container.querySelector('.cm-lintRange-error, .cm-lint-marker-error')).toBeNull()
  })

  it('words a problem without a line in the strip only', async () => {
    const { screen } = await mountEditor({ problem: { line: null, message: 'A template cannot be empty.' } })

    await expect.poll(() => screen.getByRole('status').element().textContent).toBe('A template cannot be empty.')
    expect(screen.getByRole('button').elements()).toEqual([])
    expect(screen.container.querySelector('.cm-lintRange-error, .cm-lint-marker-error')).toBeNull()
  })

  it('draws the doubled ink border when invalid, and nothing in red', async () => {
    const { screen, editor } = await mountEditor({ modelValue: TEMPLATE, problem: PROBLEM, invalid: true })

    await expect.element(editor).toHaveAttribute('aria-invalid', 'true')
    await expect.poll(() => getComputedStyle(frameOf(screen)).boxShadow).toContain('inset')
    expect(getComputedStyle(frameOf(screen)).borderColor).toBe(INK)
    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('puts the cursor at a line and takes the focus when its owner asks', async () => {
    const owner = defineComponent(() => {
      const editor = ref<InstanceType<typeof CodeEditor>>()
      return () => h('div', [
        h('button', { onClick: () => editor.value?.goToLine(2) }, 'Show the first'),
        h('button', { onClick: () => editor.value?.focus() }, 'Add a template'),
        h(CodeEditor, { 'ref': editor, 'modelValue': TEMPLATE, 'mode': 'liquid', 'aria-label': NAME }),
      ])
    })
    const screen = await mount(owner)
    const editor = screen.getByRole('textbox', { name: NAME })
    await expect.element(editor).toBeVisible()

    await screen.getByRole('button', { name: 'Add a template' }).click()
    await expect.element(editor).toHaveFocus()

    await screen.getByRole('button', { name: 'Show the first' }).click()
    await expect.element(editor).toHaveFocus()
    expect(currentLineOf(screen)).toBe('2')
  })
})

describe('code editor: the modes', () => {
  it('lays a wash ground behind Liquid in the Liquid mode', async () => {
    const { screen } = await mountEditor({ modelValue: '<p>{{ location }}</p>{% comment %}x{% endcomment %}' })

    await expect.poll(() => [...screen.container.querySelectorAll('.cm-liquid')].map(mark => mark.textContent))
      .toEqual(expect.arrayContaining(['{{ location }}']))
    expect(getComputedStyle(screen.container.querySelector('.cm-liquid')!).backgroundColor).toBe('rgb(241, 241, 241)')
  })

  it('shows {{ }} as written in the HTML mode, with nothing marked', async () => {
    const { screen, editor } = await mountEditor({ mode: 'html', modelValue: '<p>{{ location }}</p>' })

    await expect.element(editor).toHaveTextContent('<p>{{ location }}</p>')
    await expect.element(screen.getByText('HTML', { exact: true })).toBeVisible()
    expect(screen.container.querySelector('.cm-liquid')).toBeNull()
  })

  it('has no line numbers and no strip as a JSON input', async () => {
    const { screen } = await mountEditor({ mode: 'json', size: 'code-input', modelValue: '{}' })
    expect(screen.container.querySelector('.cm-lineNumbers')).toBeNull()
    expect(screen.container.querySelector('.strip')).toBeNull()
  })

  it('numbers the lines of JavaScript', async () => {
    const { screen } = await mountEditor({ mode: 'javascript', size: 'code-input', modelValue: 'function transform(input) {\n  return input\n}' })

    expect(screen.container.querySelector('.cm-lineNumbers')).not.toBeNull()
    expect(screen.container.querySelector('.strip')).toBeNull()
    expect(screen.container.querySelector('.cm-lintRange-error')).toBeNull()
  })

  it('reports JSON that does not parse with the parser\'s message, and valid again once fixed', async () => {
    const onValidity = vi.fn<(validity: CodeValidity) => void>()
    const { screen } = await mountFocused({ mode: 'json', size: 'code-input', modelValue: '{ "Accept": ', onValidity })
    expect(onValidity).toHaveBeenLastCalledWith({ valid: false, message: expect.stringContaining('JSON') })
    const parserSays = (() => {
      try {
        return JSON.parse('{ "Accept": ') as never
      }
      catch (error) {
        return (error as Error).message
      }
    })()
    expect(onValidity.mock.lastCall![0].message).toBe(parserSays)
    await expect.poll(() => screen.container.querySelector('.cm-lintRange-error')).not.toBeNull()
    expect(getComputedStyle(screen.container.querySelector('.cm-lintRange-error')!).textDecorationStyle).toBe('double')

    await pressed('"application/json" }')

    expect(onValidity).toHaveBeenLastCalledWith({ valid: true, message: null })
    await expect.poll(() => screen.container.querySelector('.cm-lintRange-error')).toBeNull()
  })

  it('takes an empty JSON input as valid', async () => {
    const onValidity = vi.fn<(validity: CodeValidity) => void>()
    await mountEditor({ mode: 'json', size: 'code-input', modelValue: '  ', onValidity })

    expect(onValidity.mock.calls).toEqual([[{ valid: true, message: null }]])
  })

  it('grows a code input from three lines to 15 rem and then scrolls', async () => {
    const { screen } = await mountEditor({ mode: 'json', size: 'code-input', modelValue: '{}' })
    const lineHeight = 12 * 1.65
    const frame = frameOf(screen)
    expect(frame.getBoundingClientRect().height).toBeCloseTo(3 * lineHeight + 16 + 2, 0)

    await screen.rerender({ modelValue: Array.from({ length: 6 }, (_, index) => `"line ${index}"`).join('\n') })
    await expect.poll(() => frame.getBoundingClientRect().height).toBeCloseTo(6 * lineHeight + 16 + 2, 0)

    await screen.rerender({ modelValue: Array.from({ length: 60 }, (_, index) => `"line ${index}"`).join('\n') })
    await expect.poll(() => frame.getBoundingClientRect().height).toBe(242)
    const scroller = screen.container.querySelector('.cm-scroller')!
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  })
})

describe('code editor: a document each', () => {
  it('keeps each document\'s undo history and cursor while another is shown', async () => {
    const onUpdate = vi.fn<(text: string) => void>()
    const screen = await mount(CodeEditor, {
      props: { 'modelValue': 'full', 'document': 'full', 'mode': 'liquid', 'aria-label': NAME, 'onUpdate:modelValue': onUpdate },
    })
    const editor = screen.getByRole('textbox', { name: NAME })
    await expect.element(editor).toBeVisible()
    await pressed('{Tab}{Control>}{Home}{/Control}{ArrowRight}{ArrowRight}')
    await pressed('X')
    expect(lastTextOf(onUpdate)).toBe('fuXll')

    await screen.rerender({ document: 'quadrant', modelValue: 'quadrant' })
    await expect.poll(() => codeOf(screen)).toBe('quadrant')
    await pressed('{Control>}z{/Control}')
    await expect.poll(() => codeOf(screen)).toBe('quadrant')
    await pressed('{Control>}{End}{/Control}Y')
    expect(lastTextOf(onUpdate)).toBe('quadrantY')

    await screen.rerender({ document: 'full', modelValue: 'fuXll' })
    await expect.poll(() => codeOf(screen)).toBe('fuXll')
    await pressed('Z')
    expect(lastTextOf(onUpdate)).toBe('fuXZll')

    await pressed('{Control>}z{/Control}{Control>}z{/Control}')
    expect(lastTextOf(onUpdate)).toBe('full')

    await screen.rerender({ document: 'quadrant', modelValue: 'quadrantY' })
    await pressed('{Control>}z{/Control}')
    expect(lastTextOf(onUpdate)).toBe('quadrant')
  })

  it('gives a document that returns the problem and the lock of now', async () => {
    const screen = await mount(CodeEditor, {
      props: { 'modelValue': 'full', 'document': 'full', 'mode': 'liquid', 'aria-label': NAME },
    })
    const editor = screen.getByRole('textbox', { name: NAME })
    await expect.element(editor).toBeVisible()

    await screen.rerender({ document: 'quadrant', modelValue: '{% if %}', readOnly: true, problem: { line: 1, message: 'broken' } })
    await expect.element(editor).toHaveAttribute('aria-readonly', 'true')
    expect(screen.container.querySelector('.cm-lintRange-error')).not.toBeNull()

    await screen.rerender({ document: 'full', modelValue: 'full', readOnly: false, problem: null })
    await expect.element(editor).toHaveAttribute('aria-readonly', 'false')
    expect(screen.container.querySelector('.cm-lintRange-error')).toBeNull()
  })
})

describe('code editor: a failed fetch of its chunk', () => {
  it('shows the failed-load notice with no aria-busy when the chunk cannot be fetched', async () => {
    const screen = await mount(CodeEditor, { props: { 'mode': 'liquid', 'aria-label': NAME, 'chunkFailure': new Error('network') } })

    await expect.element(screen.getByRole('alert')).toHaveTextContent(
      'The code editor could not be loaded. Kuroshiro\'s server is not answering. If Kuroshiro was updated meanwhile, reload the page.',
    )
    await expect.element(frameOf(screen)).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('textbox').elements()).toEqual([])
    expect(elementsInSealColour(screen.container)).toEqual([])
    await expectAccessible()
  })

  it('shows the editor with the held text once "Try again" fetches it', async () => {
    const screen = await mount(CodeEditor, { props: { 'modelValue': 'kept', 'mode': 'liquid', 'aria-label': NAME, 'chunkFailure': new Error('network') } })
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    await screen.rerender({ chunkFailure: undefined })

    await screen.getByRole('button', { name: 'Try again' }).click()

    const editor = screen.getByRole('textbox', { name: NAME })
    await expect.element(editor).toBeVisible()
    await expect.element(editor).toHaveTextContent('kept')
    expect(screen.getByRole('alert').elements()).toEqual([])
    await expect.element(frameOf(screen)).not.toHaveAttribute('aria-busy')
  })
})

describe('code editor: its frame', () => {
  it('holds its place with a wash block until the editor has been fetched', async () => {
    const screen = await mount(CodeEditor, { props: { 'mode': 'liquid', 'aria-label': NAME, 'pending': true } })
    const frame = frameOf(screen)

    expect(frame.getBoundingClientRect().height).toBe(27 * 16)
    expect(getComputedStyle(frame).backgroundColor).toBe('rgb(241, 241, 241)')
    expect(screen.getByRole('textbox').elements()).toEqual([])
  })

  it('is 27 rem high on the bench, sets its code in mono at text-xs and fills a full window at text-sm', async () => {
    const { screen } = await mountEditor({ modelValue: '<p>' })
    const line = screen.container.querySelector('.cm-line')!

    expect(frameOf(screen).getBoundingClientRect().height).toBe(432)
    expect(getComputedStyle(line).fontFamily).toContain('JetBrains Mono')
    expect(getComputedStyle(line).fontSize).toBe('12px')
    expect(Number.parseFloat(getComputedStyle(line).lineHeight)).toBeCloseTo(12 * 1.65, 1)

    const tall = defineComponent(() => () => h('div', { style: 'height: 600px' }, h(CodeEditor, { 'modelValue': '<p>', 'mode': 'liquid', 'size': 'full-window', 'aria-label': 'Wide' })))
    const wide = await mount(tall)
    await expect.element(wide.getByRole('textbox', { name: 'Wide' })).toBeVisible()
    const wideFrame = wide.getByRole('textbox', { name: 'Wide' }).element().closest('.code-editor')!
    expect(wideFrame.getBoundingClientRect().height).toBe(600)
    expect(getComputedStyle(wideFrame.querySelector('.cm-line')!).fontSize).toBe('13px')
  })

  it('sets each line number beside its line from the start', async () => {
    const { screen } = await mountEditor({ modelValue: 'one\n{{ a_much_longer_second_line_of_the_template }}\nthree' })
    const tops = (selector: string) => [...screen.container.querySelectorAll(selector)].map(element => Math.round(element.getBoundingClientRect().top))

    // CodeMirror measures the wrapped long line's height against the frame's width once it is laid
    // out, so right after mount the gutter's numbers and the lines can still be at their pre-measure
    // positions; poll both together so neither side is read from a stale, pre-measure layout.
    await expect.poll(() => {
      const gutterTops = tops('.cm-lineNumbers .cm-gutterElement').slice(1)
      const lineTops = tops('.cm-line')
      return gutterTops.length === lineTops.length && gutterTops.every((top, index) => top === lineTops[index])
    }).toBe(true)
  })

  it('shows the focus ring around its frame while the focus is in the code', async () => {
    const { screen } = await mountFocused()

    await expect.poll(() => getComputedStyle(frameOf(screen)).outlineStyle).toBe('solid')
    expect(getComputedStyle(frameOf(screen)).outlineWidth).toBe('2px')
  })

  it('selects in ink with paper text', async () => {
    const { screen } = await mountFocused({ modelValue: 'selected' })

    await pressed('{Control>}a{/Control}')

    await expect.poll(() => {
      const ground = screen.container.querySelector('.cm-selectionBackground')
      return ground && getComputedStyle(ground).backgroundColor
    }).toBe(INK)
    expect(getComputedStyle(screen.container.querySelector('.cm-line')!, '::selection').color).toBe('rgb(255, 255, 255)')
  })

  it('gives the typed-in element what a Field hands its control, and leaves out what is not set', async () => {
    const { editor } = await mountEditor({ 'id': 'headers', 'aria-describedby': undefined })

    await expect.element(editor).toHaveAttribute('id', 'headers')
    await expect.element(editor).not.toHaveAttribute('aria-describedby')
  })

  it('throws without a name', async () => {
    await expect(mount(CodeEditor, { props: { mode: 'liquid' } })).rejects.toThrow('needs a name')
  })

  it('has 16 px text and a 44 px "Go to line" at a coarse pointer', async () => {
    const { screen } = await mountEditor({ modelValue: '<p>', problem: { line: 1, message: 'broken' } })

    await withCoarsePointer(async () => {
      expect(getComputedStyle(screen.container.querySelector('.cm-line')!).fontSize).toBe('16px')
      expect(screen.getByRole('button', { name: 'Go to line 1' }).element().getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible with its search open', async () => {
    const { screen } = await mountFocused({ modelValue: 'one two one' })
    await pressed('{Control>}f{/Control}')
    await expect.element(screen.getByRole('textbox', { name: 'Find' })).toHaveFocus()

    await expectAccessible()
  })

  it('is accessible with its completion open', async () => {
    const { screen } = await mountFocused({ completionData: DATA })
    await pressed('{{{{ ')
    await pressed('{Control>} {/Control}')
    await expect.element(screen.getByRole('listbox')).toBeVisible()

    await expectAccessible()
  })

  it('is accessible and does not overflow in every state', async () => {
    const screen = await mount(CodeEditorGallery)
    await arrived(screen.container)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
