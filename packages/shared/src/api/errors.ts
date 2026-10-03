/**
 * Every code a non-2xx answer of the admin API can carry: the generic code of
 * each status first, then the codes of individual endpoints.
 */
export const API_ERROR_CODES = [
  'validation',
  'bad-request',
  'forbidden',
  'not-found',
  'conflict',
  'payload-too-large',
  'unprocessable',
  'bad-gateway',
  'service-unavailable',
  'internal',
  'device-not-found',
  'screen-not-found',
  'plugin-not-found',
  'assignment-not-found',
  'plugin-already-assigned',
  'image-fetch-failed',
  'image-unreadable',
  'order-not-a-permutation',
  'demo-mode',
  'upload-too-large',
] as const

export type ApiErrorCode = typeof API_ERROR_CODES[number]

export interface ApiErrorField {
  /** Dotted path into the request, array indexes included: `dataSources.2.url`. */
  path: string
  message: string
}

export interface ApiError {
  statusCode: number
  code: ApiErrorCode
  /** One English sentence, for logs and as a fallback. A refusal is worded from `code`. */
  message: string
  fields?: ApiErrorField[]
  details?: Record<string, unknown>
}
