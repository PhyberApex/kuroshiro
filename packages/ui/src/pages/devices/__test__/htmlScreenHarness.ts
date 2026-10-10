import type { Locator } from 'vitest/browser'
import { http, HttpResponse } from 'msw'
import { userEvent } from 'vitest/browser'
import { api, apiUrl } from '@/testing/api/server'
import { buildDeviceModel, buildDeviceModelList, buildPalette } from '@/testing/fixtures/device-models'

/** The Device Models and Palettes the HTML preview draws Kitchen's markup for: TRMNL OG and its four greys. */
export function fakeHtmlPreviewLibrary() {
  api.use(
    http.get(apiUrl('device-models'), () => HttpResponse.json(buildDeviceModelList({ models: [buildDeviceModel({ cssClasses: ['screen--og_plus', 'screen--md'], cssVariables: { '--screen-w': '800px' } })] }))),
    http.get(apiUrl('device-models/palettes'), () => HttpResponse.json([buildPalette()])),
  )
}

/** The document the preview plate draws: the newest frame's. */
export const previewed = () => [...document.querySelectorAll('iframe')].at(-1)?.srcdoc ?? ''

/** The markup a code editor holds, line by line. */
export const codeIn = (editor: Locator) => [...editor.element().querySelectorAll('.cm-line')].map(line => line.textContent).join('\n')

/** Types at the end of a code editor's markup. The editor closes an HTML tag itself, so a test types words. */
export async function typeAtEnd(editor: Locator, keys: string) {
  await editor.click()
  await userEvent.keyboard(`{Control>}{End}{/Control}${keys}`)
}

/** Replaces all of a code editor's markup with the keys given, or empties it when none are given. */
export async function replaceAll(editor: Locator, keys = '') {
  await editor.click()
  await userEvent.keyboard(`{Control>}a{/Control}{Backspace}${keys}`)
}
