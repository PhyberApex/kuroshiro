import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterLink } from 'vue-router'
import { expectAccessible } from '@/testing/a11y'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import Button from '../Button.vue'
import EmptyStateGallery from '../EmptyState.gallery.vue'
import EmptyState from '../EmptyState.vue'

const NoDevice = defineComponent(() => () => h(EmptyState, { title: 'No Device here', page: true }, {
  default: () => 'It may have been deleted.',
  action: () => h(Button, { asChild: true }, () => h(RouterLink, { to: '/' }, () => 'All Devices')),
}))

describe('empty state', () => {
  it('is a heading and a sentence', async () => {
    const screen = await mount(EmptyState, {
      props: { title: 'No Screens yet' },
      slots: { default: 'Kitchen shows the welcome screen until you add one.' },
    })

    await expect.element(screen.getByRole('heading', { name: 'No Screens yet', level: 2 })).toBeVisible()
    await expect.element(screen.getByText('Kitchen shows the welcome screen until you add one.')).toBeVisible()
  })

  it('takes the heading level its place in the page asks for', async () => {
    const screen = await mount(EmptyState, { props: { title: 'No Screens yet', heading: 'h3' } })

    await expect.element(screen.getByRole('heading', { name: 'No Screens yet', level: 3 })).toBeVisible()
  })

  it('holds its action under the sentence', async () => {
    const screen = await mount(EmptyState, {
      props: { title: 'No Screens yet' },
      slots: { default: 'Kitchen shows the welcome screen until you add one.', action: '<button>Add Screen</button>' },
    })
    const top = (element: Element) => element.getBoundingClientRect().top

    expect(top(screen.getByRole('button', { name: 'Add Screen' }).element()))
      .toBeGreaterThan(top(screen.getByText('Kitchen shows the welcome screen until you add one.').element()))
  })

  it('is not announced: an empty state is no failure', async () => {
    const screen = await mount(EmptyStateGallery)

    expect(screen.container.querySelector('[role="alert"], [role="status"], [aria-live]')).toBeNull()
  })

  it('is the page\'s title at the whole-page size, with one link back', async () => {
    const screen = await mountPage({
      routes: [{ path: '/', component: { render: () => null } }, { path: '/devices/:id', component: NoDevice }],
      at: '/devices/42',
    })
    const sectionTitle = await mount(EmptyState, { props: { title: 'No Screens yet' } })
    const fontSize = (name: string, from = screen) => Number.parseFloat(getComputedStyle(from.getByRole('heading', { name }).element()).fontSize)

    await expect.element(screen.getByRole('heading', { name: 'No Device here', level: 1 })).toBeVisible()
    expect(fontSize('No Device here')).toBeGreaterThan(fontSize('No Screens yet', sectionTitle as never))
    expect(screen.getByRole('link').elements()).toHaveLength(1)

    await screen.getByRole('link', { name: 'All Devices' }).click()

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/')
  })

  it('has nothing in the seal colour', async () => {
    const screen = await mount(EmptyStateGallery)

    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(EmptyStateGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
