import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'
import {
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { tap } from 'rxjs'
import { SKIP_REQUEST_LOG } from './skip-request-log.decorator.js'

/**
 * A Webhook Token is the whole credential of `/api/webhook/<token>` (the route of
 * `WebhookIngestController`), so such a request is logged without the rest of its
 * URL: the token may be followed by a slash or a query string. Tested against the
 * path Express routes on rather than the raw URL, which a client may send in
 * absolute form (`http://host/api/webhook/<token>`); and without letter case,
 * as Express routes.
 */
const WEBHOOK_PATH = /^\/api\/webhook\//i

/** The request URL as the request log may hold it: with no credential in it. */
function redactRequestUrl(request: Request): string {
  return WEBHOOK_PATH.test(request.path) ? '/api/webhook/[redacted]' : request.url
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')
  private readonly reflector = new Reflector()

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.reflector.getAllAndOverride<boolean>(SKIP_REQUEST_LOG, [context.getHandler(), context.getClass()]))
      return next.handle()

    const ctx = context.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()

    const { method } = request
    const url = redactRequestUrl(request)
    const startTime = Date.now()

    return next.handle().pipe(
      tap({
        // The response body is never logged: it carries Device API keys, Webhook Tokens
        // and Data Source headers, and container logs outlive key rotation.
        next: () => {
          const duration = Date.now() - startTime
          const statusCode = response.statusCode

          this.logger.debug(
            `${method} ${url} ${statusCode} - ${duration}ms`,
          )
        },
        error: (error) => {
          const duration = Date.now() - startTime
          const statusCode = error.status || 500

          this.logger.debug(
            `${method} ${url} ${statusCode} - ${duration}ms [ERROR: ${error.message}]`,
          )
        },
      }),
    )
  }
}
