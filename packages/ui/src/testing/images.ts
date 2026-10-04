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
