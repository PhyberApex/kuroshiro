import type { CreateExternalScreenInput, ScreenRead } from 'kuroshiro-shared'
import type { Page } from 'playwright'
import { Buffer } from 'node:buffer'

/** One pixel: the smallest image the server converts into a Screen. */
export const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

export async function addFileScreen(baseUrl: string, deviceId: string, name: string) {
  const form = new FormData()
  form.set('kind', 'file')
  form.set('deviceId', deviceId)
  form.set('name', name)
  form.set('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), `${name}.png`)
  const response = await fetch(new URL('api/screens', baseUrl), { method: 'POST', body: form })
  if (!response.ok)
    throw new Error(`Adding the Screen ${name} answered ${response.status}: ${await response.text()}`)
  return await response.json() as ScreenRead
}

/** An External link fetched at every turn, so adding it fetches and converts nothing. */
export async function addExternalScreen(baseUrl: string, deviceId: string, name: string) {
  const input = { kind: 'external', deviceId, name, url: new URL('screens/welcome.png', baseUrl).href, fetchManual: false } satisfies CreateExternalScreenInput
  const response = await fetch(new URL('api/screens', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok)
    throw new Error(`Adding the Screen ${name} answered ${response.status}: ${await response.text()}`)
  return await response.json() as ScreenRead
}

/** The Screen State each row words, by the row's name, in the Order the rows stand in. */
export function screenStates(page: Page) {
  return page.locator('.screen-row').evaluateAll(rows => Object.fromEntries(rows.map(row => [
    row.querySelector('.trigger')?.textContent?.trim(),
    row.querySelector('.state')?.textContent?.trim(),
  ])))
}
