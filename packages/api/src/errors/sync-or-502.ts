import type { Logger } from '@nestjs/common'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { ApiException } from './api.exception.js'

/** Runs a TRMNL sync, turning a failure into a 502 `upstream-unreachable` worded with `what` (e.g. "device models", "firmware"). */
export async function syncOr502<T>(logger: Logger, what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  }
  catch (err) {
    const message = getErrorMessage(err)
    logger.error(`Could not sync ${what} from TRMNL: ${message}`)
    throw new ApiException(502, 'upstream-unreachable', `Could not sync ${what} from TRMNL: ${message}`, { reason: message })
  }
}
