import { userEvent } from 'vitest/browser'

/**
 * Presses a key the way a hand does: down, a moment, up. A Reka radio group chooses the radio
 * an arrow key moved to only if the key is still down a tick later, which `userEvent.keyboard('{ArrowRight}')`
 * never is.
 */
export async function pressAndHold(key: string) {
  await userEvent.keyboard(`{${key}>}`)
  await new Promise(resolve => setTimeout(resolve, 0))
  await userEvent.keyboard(`{/${key}}`)
}
