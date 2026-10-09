import type { ApiError } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import { buildApiError } from '../fixtures/errors'

/** The absolute URL of an admin API path, resolved the way the UI resolves it: against the document base. */
export function apiUrl(path: string) {
  return new URL(`api/${path}`, document.baseURI).href
}

/**
 * The faked admin API. A spec fakes what its page reads with
 * `api.use(http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())))`;
 * the handlers are dropped after each test. A request no handler fakes fails as a network
 * error and is named on the console.
 */
export const api = setupWorker(
  http.all(apiUrl('*'), ({ request }) => {
    console.error(`No handler fakes ${request.method} ${request.url}. Add one with api.use().`)
    return HttpResponse.error()
  }),
)

/** A refusal in the API's error envelope, answered with the status the envelope names. */
export function apiErrorResponse(overrides: Partial<ApiError> = {}) {
  const error = buildApiError(overrides)
  return HttpResponse.json(error, { status: error.statusCode })
}

const ONE_WAY_WORKER_MESSAGES = new Set(['MOCKING_ENABLED', 'INTEGRITY_CHECK_RESPONSE', 'KEEPALIVE_RESPONSE', 'CLIENT_CLOSED'])

/**
 * MSW's worker keeps each of these messages open until the page answers it, which MSW's own
 * page side never does. Chromium terminates a worker whose message stays open for five minutes,
 * and the restarted worker has forgotten every page, so requests then reach the real network
 * (mswjs/msw#2801). Answering them lets the worker finish each message.
 */
function answerOneWayWorkerMessages() {
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if (ONE_WAY_WORKER_MESSAGES.has(event.data?.type))
      event.ports[0]?.postMessage(null)
  })
}

export function startFakedApi() {
  answerOneWayWorkerMessages()
  return api.start({
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledFrame: 'bypass',
  })
}
