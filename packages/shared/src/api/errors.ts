/**
 * Every code a non-2xx answer of the admin API can carry. The first entries are
 * the generic code of each status; an endpoint's own codes are added here by
 * the slice that lands the endpoint.
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
