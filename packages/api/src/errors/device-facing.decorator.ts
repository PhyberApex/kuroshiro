import { UseFilters } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

/**
 * Marks a route the firmware or an outside sender calls. Its failures keep
 * Nest's default `{ statusCode, message, error }` body instead of the admin
 * API's error envelope.
 */
export const DeviceFacing = () => UseFilters(BaseExceptionFilter)
