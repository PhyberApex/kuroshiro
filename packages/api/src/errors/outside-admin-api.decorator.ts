import { UseFilters } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

/**
 * Marks a route that someone other than the admin UI calls: the firmware, a
 * Webhook sender, a metrics scraper. Its failures keep Nest's default
 * `{ statusCode, message, error }` body instead of the admin API's error envelope.
 */
export const OutsideAdminApi = () => UseFilters(BaseExceptionFilter)
