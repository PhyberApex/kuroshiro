import type { ApiErrorCode, ApiErrorField } from 'kuroshiro-shared'
import { STATUS_CODES } from 'node:http'
import { HttpException } from '@nestjs/common'

/**
 * The way a service or controller refuses a request of the admin API:
 * `throw new ApiException(HttpStatus.CONFLICT, 'conflict', 'That MAC is taken.', { mac })`.
 *
 * Its Nest response keeps Nest's default `{ statusCode, message, error }` shape,
 * which is what a Device-facing route answers with (see `DeviceFacing`).
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(HttpException.createBody(message, STATUS_CODES[status] ?? 'Error', status), status)
  }
}

export class ValidationException extends ApiException {
  constructor(readonly fields: ApiErrorField[], private readonly flatMessages: string[]) {
    super(400, 'validation', 'The request has invalid fields.')
  }

  getResponse(): object {
    return HttpException.createBody(this.flatMessages, STATUS_CODES[400]!, 400)
  }
}
