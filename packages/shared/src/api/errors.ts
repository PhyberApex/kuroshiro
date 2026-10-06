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
  'device-mac-taken',
  'screen-not-found',
  'screen-field-not-for-kind',
  'schedule-not-found',
  'schedule-exists',
  'plugin-not-found',
  'assignment-not-found',
  'plugin-already-assigned',
  'plugin-in-mashup',
  'plugin-not-webhook',
  'image-fetch-failed',
  'image-unreadable',
  'order-not-a-permutation',
  'demo-mode',
  'upload-too-large',
  'firmware-version-taken',
  'device-model-unknown',
  'palette-unknown',
  'palette-not-for-model',
  'device-preview-busy',
  'firmware-not-custom',
  'firmware-push-without-target',
  'firmware-push-mirrored',
  'firmware-push-pending',
  'upstream-unreachable',
  'template-full-missing',
  'template-invalid',
  'notifications-off',
  'notification-failed',
  'import-not-zip',
  'import-no-plugin',
  'import-legacy-format',
  'github-url-invalid',
  'github-repo-not-found',
  'recipe-id-invalid',
  'recipe-not-found',
  'recipe-oauth',
  'recipe-strategy-unsupported',
  'recipe-static-transform',
  'recipe-none-transform',
  'plugin-not-from-recipe',
  'recipe-changed',
  'archive-not-zip',
  'archive-not-configuration',
  'archive-schema-version',
  'archive-record-refused',
  'palette-name-taken',
  'palette-not-custom',
  'palette-in-use',
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
