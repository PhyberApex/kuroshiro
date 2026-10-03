import { expect } from 'vitest'

/**
 * Resolves once every code editor under `root` has been fetched and every preview plate has drawn its
 * document: the `div` of each is `aria-busy` until then. A busy button or switch is a state that stays.
 */
export function arrived(root: Element = document.body) {
  return expect.poll(() => root.querySelectorAll('div[aria-busy="true"]').length).toBe(0)
}
