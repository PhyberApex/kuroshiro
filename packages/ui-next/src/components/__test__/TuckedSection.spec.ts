import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withMotionAllowed } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import TuckedSectionGallery from '../TuckedSection.gallery.vue'
import TuckedSection from '../TuckedSection.vue'

const INSIDE = 'What Weather asks for wherever it is shown.'

function sectionOf(props: object = {}) {
  return defineComponent({
    emits: ['toggled'],
    setup(_, { emit }) {
      const open = ref(false)
      return () => h(TuckedSection, {
        'title': 'Plugin Fields',
        ...props,
        'open': open.value,
        'onUpdate:open': (next: boolean) => {
          open.value = next
          emit('toggled', next)
        },
      }, () => h('p', INSIDE))
    },
  })
}

afterEach(() => {
  history.replaceState(null, '', location.pathname + location.search)
})

describe('tucked section', () => {
  it('is closed by default, under a heading that is its trigger', async () => {
    const screen = await mount(TuckedSection, { props: { title: 'Plugin Fields' }, slots: { default: () => h('p', INSIDE) } })

    const trigger = screen.getByRole('heading', { name: 'Plugin Fields', level: 2 }).getByRole('button', { name: 'Plugin Fields' })
    await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect.element(screen.getByText(INSIDE)).not.toBeInTheDocument()
  })

  it('takes the heading level its place in the page asks for', async () => {
    const screen = await mount(TuckedSection, { props: { title: 'Data', heading: 'h3' } })

    await expect.element(screen.getByRole('heading', { name: 'Data', level: 3 })).toBeVisible()
  })

  it.for(['{Enter}', ' '])('opens and closes with %s and exposes its expanded state', async (key) => {
    const onToggled = vi.fn()
    const screen = await mount(sectionOf(), { props: { onToggled } })
    const trigger = screen.getByRole('button', { name: 'Plugin Fields' })

    await userEvent.keyboard('{Tab}')
    await expect.element(trigger).toHaveFocus()
    await userEvent.keyboard(key)

    await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect.element(screen.getByText(INSIDE)).toBeVisible()
    expect(trigger.element().getAttribute('aria-controls')).toBe(screen.getByText(INSIDE).element().closest('[id]')?.id)

    await userEvent.keyboard(key)

    await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect.element(screen.getByText(INSIDE)).not.toBeInTheDocument()
    expect(onToggled.mock.calls).toEqual([[true], [false]])
  })

  it('toggles on a click', async () => {
    const screen = await mount(sectionOf())

    await screen.getByRole('button', { name: 'Plugin Fields' }).click()

    await expect.element(screen.getByText(INSIDE)).toBeVisible()
  })

  it('opens when the address names it by its fragment, on arrival and later', async () => {
    const Page = sectionOf({ id: 'plugin-fields' })
    const screen = await mountPage({ routes: [{ path: '/plugins/weather', component: Page }], at: '/plugins/weather' })
    await expect.element(screen.getByText(INSIDE)).not.toBeInTheDocument()

    await screen.router.push('/plugins/weather#plugin-fields')

    await expect.element(screen.getByText(INSIDE)).toBeVisible()
    expect(document.getElementById('plugin-fields')).toContainElement(screen.getByText(INSIDE).element() as HTMLElement)

    const arriving = await mountPage({ routes: [{ path: '/plugins/weather', component: Page }], at: '/plugins/weather#plugin-fields' })
    await expect.element(arriving.getByText(INSIDE).last()).toBeVisible()
  })

  it('stays closed for a fragment that names something else', async () => {
    const screen = await mountPage({
      routes: [{ path: '/plugins/weather', component: sectionOf({ id: 'plugin-fields' }) }],
      at: '/plugins/weather#recipe',
    })

    await expect.element(screen.getByRole('button', { name: 'Plugin Fields' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('follows the window\'s address where there is no router', async () => {
    const screen = await mount(sectionOf({ id: 'plugin-fields' }))

    location.hash = '#plugin-fields'

    await expect.element(screen.getByText(INSIDE)).toBeVisible()
  })

  it('draws a rule above and below, and turns its chevron when open', async () => {
    const screen = await mount(sectionOf({ id: 'plugin-fields' }))
    const section = document.getElementById('plugin-fields')!
    const chevron = section.querySelector('svg')!

    await expect.poll(() => [getComputedStyle(section).borderTopWidth, getComputedStyle(section).borderBottomWidth]).toEqual(['1px', '1px'])
    expect(getComputedStyle(chevron).rotate).toBe('none')

    await screen.getByRole('button', { name: 'Plugin Fields' }).click()

    await expect.poll(() => getComputedStyle(chevron).rotate).toBe('180deg')
  })

  it('unfolds in 200 ms, and without any animation where motion is reduced', async () => {
    const screen = await mount(sectionOf())
    await screen.getByRole('button', { name: 'Plugin Fields' }).click()
    const content = () => screen.getByText(INSIDE).element().closest('[data-state]')!

    await expect.element(screen.getByText(INSIDE)).toBeVisible()
    expect(getComputedStyle(content()).animationName).toBe('none')

    await withMotionAllowed(async () => {
      expect(getComputedStyle(content()).animationName).not.toBe('none')
      expect(getComputedStyle(content()).animationDuration).toBe('0.2s')
    })
  })

  it('has a 44 px trigger', async () => {
    const screen = await mount(sectionOf())

    expect(screen.getByRole('button', { name: 'Plugin Fields' }).element().getBoundingClientRect().height).toBe(44)
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(TuckedSectionGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
