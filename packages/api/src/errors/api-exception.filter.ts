import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import type { ApiError, ApiErrorCode } from 'kuroshiro-shared'
import { Catch, HttpException, Logger } from '@nestjs/common'
import { ApiException, ValidationException } from './api.exception.js'
import { isUniqueViolation } from './unique-violation.js'

const GENERIC_CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'bad-request',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  413: 'payload-too-large',
  422: 'unprocessable',
  502: 'bad-gateway',
  503: 'service-unavailable',
}

function genericCodeFor(status: number): ApiErrorCode {
  return GENERIC_CODE_BY_STATUS[status] ?? (status >= 500 ? 'internal' : 'bad-request')
}

function messageOf(exception: HttpException): string {
  const response = exception.getResponse()
  const message = typeof response === 'string' ? response : (response as { message?: unknown }).message
  if (Array.isArray(message))
    return message.join('; ')
  return typeof message === 'string' ? message : exception.message
}

/**
 * Errors raised by Express middleware (body-parser's "request entity too
 * large") are not HttpExceptions but carry their status the http-errors way.
 */
function httpErrorStatus(exception: unknown): number | undefined {
  const status = (exception as { statusCode?: unknown } | null)?.statusCode
  return typeof status === 'number' && status >= 400 && status < 500 && exception instanceof Error
    ? status
    : undefined
}

/** `undefined` when the exception is not one the API meant to answer with: a bug. */
export function toApiError(exception: unknown): ApiError | undefined {
  if (exception instanceof ApiException) {
    return {
      statusCode: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      ...(exception instanceof ValidationException && { fields: exception.fields }),
      ...(exception.details && { details: exception.details }),
    }
  }
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus()
    return { statusCode, code: genericCodeFor(statusCode), message: messageOf(exception) }
  }
  if (isUniqueViolation(exception))
    return { statusCode: 409, code: 'conflict', message: 'The request conflicts with a record that already exists.' }
  const statusCode = httpErrorStatus(exception)
  if (statusCode !== undefined)
    return { statusCode, code: genericCodeFor(statusCode), message: (exception as Error).message }
  return undefined
}

const INTERNAL_ERROR: ApiError = { statusCode: 500, code: 'internal', message: 'Internal server error' }

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const known = toApiError(exception)
    if (!known) {
      const error = exception instanceof Error ? exception : new Error(String(exception))
      this.logger.error(error.message, error.stack)
    }
    const body = known ?? INTERNAL_ERROR
    const response = host.switchToHttp().getResponse<Response>()
    if (response.headersSent) {
      response.end()
      return
    }
    response.status(body.statusCode).json(body)
  }
}
