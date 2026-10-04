import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import Confirmation from '../Confirmation.gallery.vue'
import ConfirmationComponent from '../Confirmation.vue'

afterEach(() => vi.restoreAllMocks())

/** A page with the button that asks and the confirmation it opens. */
function deleting(action: () => unknown = () => {}, props: object = {}) {
  return defineComponent({
    emits: ['confirmed'],
    setup(_, { emit }) {
      const open = ref(false)
      return () => [
        h('button', { onClick: () => (open.value = true) }, 'Delete Screen…'),
        h(ConfirmationComponent, {
          'title': 'Delete Weekend board?',
          'confirmLabel': 'Delete Screen',
          'safeLabel': 'Keep Screen',
          action,
          ...props,
          'open': open.value,
          'onUpdate:open': (next: boolean) => (open.value = next),
          'onConfirmed': () => emit('confirmed'),
        }, {
          lost: () => 'The Screen leaves Kitchen\'s Rotation and its Schedule is lost.',
          stays: () => 'The Plugins in its slots stay in your library.',
        }),
      ]
    },
  })
}

async function open(action?: () => unknown, props: object = {}) {
  const onConfirmed = vi.fn()
  const screen = await mount(deleting(action, props), { props: { onConfirmed } })
  const asker = screen.getByRole('button', { name: 'Delete Screen…' }).element()
  await userEvent.keyboard('{Tab}{Enter}')
  const dialog = screen.getByRole('alertdialog')
  await expect.element(dialog).toBeVisible()
  return {
    screen,
    asker,
    dialog,
    onConfirmed,
    safe: screen.getByRole('button', { name: 'Keep Screen' }),
    confirm: screen.getByRole('button', { name: 'Delete Screen', exact: true }),
  }
}

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('confirmation', () => {
  it('is an alert dialog named by its title and described by what is lost and what stays', async () => {
    const { dialog } = await open()

    await expect.element(dialog).toHaveAccessibleName('Delete Weekend board?')
    await expect.element(dialog).toHaveAccessibleDescription(
      'Lost The Screen leaves Kitchen\'s Rotation and its Schedule is lost. Stays The Plugins in its slots stay in your library.',
    )
    await expect.element(dialog.getByRole('heading', { name: 'Delete Weekend board?', level: 2 })).toBeVisible()
  })

  it('opens with the focus on the safe choice', async () => {
    const { safe } = await open()

    await expect.element(safe).toHaveFocus()
  })

  it('keeps Tab inside it', async () => {
    const { safe, confirm } = await open()

    await userEvent.keyboard('{Tab}')
    await expect.element(confirm).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(safe).toHaveFocus()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    await expect.element(confirm).toHaveFocus()
  })

  it('closes on Escape, does nothing, and gives the focus back', async () => {
    const action = vi.fn()
    const { screen, asker, onConfirmed } = await open(action)

    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
    await expect.element(asker).toHaveFocus()
    expect(action).not.toHaveBeenCalled()
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('closes on the safe choice, does nothing, and gives the focus back', async () => {
    const action = vi.fn()
    const { screen, asker } = await open(action)

    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
    await expect.element(asker).toHaveFocus()
    expect(action).not.toHaveBeenCalled()
  })

  it('stays open on a click on the scrim', async () => {
    const { dialog } = await open()

    await userEvent.click(document.body, { position: { x: 5, y: 5 } })

    await expect.element(dialog).toBeVisible()
  })

  it.for([undefined, '', '  '])('cannot be mounted without a confirming label (%o)', async (confirmLabel) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(mount(ConfirmationComponent, { props: { title: 'Delete Weekend board?', confirmLabel: confirmLabel as string, action: () => {} } }))
      .rejects
      .toThrow('A Confirmation needs a confirmLabel')
  })

  it('names the safe choice "Cancel" unless the caller names it', async () => {
    const { screen } = await open(undefined, { safeLabel: undefined })

    await expect.element(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('shows the loading mark on the confirming button while its action runs, and cannot be left meanwhile', async () => {
    const running = deferred()
    const action = vi.fn(() => running.promise)
    const { dialog, safe, confirm, onConfirmed } = await open(action)

    await confirm.click()

    await expect.element(confirm).toHaveAttribute('aria-busy', 'true')
    await expect.element(safe).toBeDisabled()
    await confirm.click({ force: true })
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).toBeVisible()
    expect(action).toHaveBeenCalledOnce()
    expect(onConfirmed).not.toHaveBeenCalled()

    running.resolve()
  })

  it('closes once its action has run, and says so', async () => {
    const { screen, confirm, onConfirmed } = await open(async () => {})

    await confirm.click()

    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
    expect(onConfirmed).toHaveBeenCalledOnce()
  })

  it('stays open when its action is rejected and shows the reason', async () => {
    const { dialog, safe, confirm, onConfirmed } = await open(async () => {
      throw new Error('Kuroshiro\'s server is not answering.')
    })

    await confirm.click()

    await expect.element(dialog.getByText('Kuroshiro\'s server is not answering.')).toBeVisible()
    await expect.element(dialog).toBeVisible()
    await expect.element(confirm).not.toHaveAttribute('aria-busy')
    await expect.element(safe).toBeEnabled()
    expect(onConfirmed).not.toHaveBeenCalled()
    expect(elementsInSealColour(dialog.element())).toEqual([])
  })

  it('drops the reason when it is tried again and when it is opened again', async () => {
    const action = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Kuroshiro\'s server is not answering.'))
      .mockRejectedValueOnce(new Error('Kuroshiro\'s server is not answering.'))
      .mockImplementation(() => new Promise(() => {}))
    const { screen, dialog, confirm } = await open(action)
    const reason = dialog.getByText('Kuroshiro\'s server is not answering.')

    await confirm.click()
    await expect.element(reason).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Enter}')
    await expect.element(screen.getByRole('alertdialog')).toBeVisible()
    await expect.element(reason).not.toBeInTheDocument()

    await confirm.click()
    await expect.element(reason).toBeVisible()
    await confirm.click()
    await expect.element(reason).not.toBeInTheDocument()
  })

  it('has a 2 px ink border, no shadow, and sits on the scrim', async () => {
    const { dialog } = await open()
    const box = dialog.element()
    const scrim = document.querySelector('.scrim')!

    await expect.poll(() => getComputedStyle(box).borderTopWidth).toBe('2px')
    expect(getComputedStyle(box).borderTopColor).toBe(getComputedStyle(document.body).color)
    expect(getComputedStyle(box).boxShadow).toBe('none')
    expect(getComputedStyle(scrim).backgroundColor).toBe('rgba(18, 18, 18, 0.45)')
    expect(scrim.getBoundingClientRect().width).toBe(window.innerWidth)
  })

  it('arrives in 200 ms, and without any animation where motion is reduced', async () => {
    const { dialog } = await open()

    expect(getComputedStyle(dialog.element()).animationName).toBe('none')
    expect(getComputedStyle(document.querySelector('.scrim')!).animationName).toBe('none')

    await withMotionAllowed(async () => {
      expect(getComputedStyle(dialog.element()).animationName).not.toBe('none')
      expect(getComputedStyle(dialog.element()).animationDuration).toBe('0.2s')
    })
  })

  it('has the safe choice alone when there is nothing to confirm, and a link beside it when one is given', async () => {
    const Refusing = defineComponent(() => {
      const open = ref(false)
      return () => [
        h('button', { onClick: () => (open.value = true) }, 'Delete Plugin…'),
        h(ConfirmationComponent, {
          'title': 'Weather cannot be deleted yet',
          'safeLabel': 'Close',
          'open': open.value,
          'onUpdate:open': (next: boolean) => (open.value = next),
        }, {
          default: () => 'It fills a slot in the Mashup Weekend board on Kitchen.',
          also: () => h('a', { href: '#weekend-board' }, 'Open the Mashup'),
        }),
      ]
    })
    const screen = await mount(Refusing)
    await userEvent.keyboard('{Tab}{Enter}')
    const dialog = screen.getByRole('alertdialog', { name: 'Weather cannot be deleted yet' })

    await expect.element(dialog).toHaveAccessibleDescription('It fills a slot in the Mashup Weekend board on Kitchen.')
    expect(dialog.getByRole('button').elements().map(button => button.textContent?.trim())).toEqual(['Close'])
    await expect.element(dialog.getByRole('button', { name: 'Close' })).toHaveFocus()
    await expect.element(dialog.getByRole('link', { name: 'Open the Mashup' })).toBeVisible()
    await expectAccessible(dialog.element())

    await userEvent.keyboard('{Enter}')

    await expect.element(dialog).not.toBeInTheDocument()
  })

  it('fits a phone', async () => {
    const { dialog } = await open()

    await expectNoHorizontalOverflow()
    const box = dialog.element().getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(window.innerWidth)
  })

  it('is accessible while open', async () => {
    const { dialog } = await open()

    await expectAccessible(dialog.element())
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(Confirmation)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
