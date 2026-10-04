import type { ApiError } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildApiError = defineBuilder<ApiError>(() => ({
  statusCode: 404,
  code: 'not-found',
  message: 'Device 3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11 was not found.',
}))
