import { http, HttpResponse } from 'msw'
import { screenArt } from '@/gallery/screenArt'
import { api } from './api/server'

/**
 * Answers every Screen image a page asks for (`/screens/…`) with the same drawing, so a plate shows an image and not its error state.
 */
export function fakeScreenImages() {
  const svg = decodeURIComponent(screenArt(800, 480).replace('data:image/svg+xml,', ''))
  api.use(http.get(new URL('screens/*', document.baseURI).href, () =>
    new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } })))
}

/** Where TRMNL keeps a Recipe's screenshot and icon, which the Recipe Gallery loads as given. */
export const TRMNL_IMAGE_BUCKET = 'https://trmnl-public.s3.us-east-2.amazonaws.com'

/**
 * Answers every picture of TRMNL's bucket with the same drawing, so a shot of the Recipe Gallery does not move when a
 * Recipe's author uploads a new screenshot, and a spec does not reach trmnl.com.
 */
export function fakeRecipeImages() {
  const svg = decodeURIComponent(screenArt(800, 480).replace('data:image/svg+xml,', ''))
  api.use(http.get(`${TRMNL_IMAGE_BUCKET}/*`, () =>
    new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } })))
}
