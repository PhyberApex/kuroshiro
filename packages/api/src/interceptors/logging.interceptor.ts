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
import { tap } from 'rxjs'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()

    const { method, url } = request
    const startTime = Date.now()

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const duration = Date.now() - startTime
          const statusCode = response.statusCode

          this.logger.debug(
            `${method} ${url} ${statusCode} - ${duration}ms`,
          )

          // Optionally log response body (uncomment if needed, can be verbose)
          this.logger.debug(`Response body: ${JSON.stringify(responseBody)}`)
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
