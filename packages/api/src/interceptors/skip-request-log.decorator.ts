import { SetMetadata } from '@nestjs/common'

export const SKIP_REQUEST_LOG = 'skipRequestLog'

/**
 * Keeps a controller's requests out of the `LoggingInterceptor` request log: for a
 * route a probe calls every few seconds, where one line per call would flood the log.
 */
export const SkipRequestLog = () => SetMetadata(SKIP_REQUEST_LOG, true)
