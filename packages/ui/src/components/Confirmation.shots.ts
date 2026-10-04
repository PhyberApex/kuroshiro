import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import { resetViewport, resizeTo } from '@/testing/viewport'
import Button from './Button.vue'
import Confirmation from './Confirmation.vue'

function deleting(action: () => unknown) {
  return defineComponent(() => {
    const open = ref(false)
    return () => [
      h('button', { onClick: () => (open.value = true) }, 'Delete Screen…'),
      h(Confirmation, {
        'title': 'Delete Weekend board?',
        'confirmLabel': 'Delete Screen',
        'safeLabel': 'Keep Screen',
        action,
        'open': open.value,
        'onUpdate:open': (next: boolean) => (open.value = next),
      }, {
        lost: () => 'The Screen leaves Kitchen\'s Rotation and its Schedule is lost.',
        stays: () => 'The Plugins in its slots stay in your library.',
      }),
    ]
  })
}

function refusing() {
  return defineComponent(() => {
    const open = ref(false)
    return () => [
      h('button', { onClick: () => (open.value = true) }, 'Delete Plugin…'),
      h(Confirmation, {
        'title': 'Weather cannot be deleted yet',
        'safeLabel': 'Close',
        'open': open.value,
        'onUpdate:open': (next: boolean) => (open.value = next),
      }, {
        default: () => 'It fills a slot in the Mashup Weekend board on Kitchen. Give that slot another Plugin, or delete the Mashup. Then Weather can be deleted.',
        also: () => h(Button, { asChild: true }, () => h('a', { href: '#weekend-board' }, 'Open the Mashup')),
      }),
    ]
  })
}

const STAGE = { width: 640, height: 400 }

// The gallery shows a confirmation closed, because an open one hides the rest of the page from assistive technology; its open states are shot here, scrim included.
describe('confirmation baselines', () => {
  it.for(THEMES)('open, with the safe choice focused, in %s', async (theme) => {
    await resizeTo(STAGE.width, STAGE.height)
    try {
      const screen = await mount(deleting(() => {}), { theme })
      await userEvent.keyboard('{Tab}{Enter}')
      await expect.element(screen.getByRole('button', { name: 'Keep Screen' })).toHaveFocus()

      await expectScreenshot(page.elementLocator(document.body), `confirmation-open-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })

  it.for(THEMES)('running its action in %s', async (theme) => {
    await resizeTo(STAGE.width, STAGE.height)
    try {
      const screen = await mount(deleting(() => new Promise(() => {})), { theme })
      await userEvent.keyboard('{Tab}{Enter}')
      await userEvent.keyboard('{Tab}{Enter}')
      await expect.element(screen.getByRole('button', { name: 'Delete Screen', exact: true })).toHaveAttribute('aria-busy', 'true')

      await expectScreenshot(page.elementLocator(document.body), `confirmation-running-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })

  it.for(THEMES)('after its action failed in %s', async (theme) => {
    await resizeTo(STAGE.width, STAGE.height)
    try {
      const screen = await mount(deleting(() => Promise.reject(new Error('Kuroshiro\'s server is not answering.'))), { theme })
      await userEvent.keyboard('{Tab}{Enter}')
      await userEvent.keyboard('{Tab}{Enter}')
      await expect.element(screen.getByText('Kuroshiro\'s server is not answering.')).toBeVisible()

      await expectScreenshot(page.elementLocator(document.body), `confirmation-failed-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })

  it.for(THEMES)('with nothing to confirm, in %s', async (theme) => {
    await resizeTo(STAGE.width, STAGE.height)
    try {
      const screen = await mount(refusing(), { theme })
      await userEvent.keyboard('{Tab}{Enter}')
      await expect.element(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

      await expectScreenshot(page.elementLocator(document.body), `confirmation-nothing-to-confirm-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })
})
