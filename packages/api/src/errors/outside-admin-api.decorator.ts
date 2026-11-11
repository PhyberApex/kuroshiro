import { applyDecorators, SetMetadata, UseFilters } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

/** The metadata key `OutsideAdminApi` sets, which the cross-site refusal reads. */
export const OUTSIDE_ADMIN_API = 'kuroshiro:outside-admin-api'

/**
 * Marks a route that someone other than the admin UI calls: the firmware, a
 * Webhook sender, a metrics scraper. Its failures keep Nest's default
 * `{ statusCode, message, error }` body instead of the admin API's error envelope,
 * and it is not refused for coming from another origin, since its callers are not browsers.
 */
export const OutsideAdminApi = () => applyDecorators(UseFilters(BaseExceptionFilter), SetMetadata(OUTSIDE_ADMIN_API, true))
