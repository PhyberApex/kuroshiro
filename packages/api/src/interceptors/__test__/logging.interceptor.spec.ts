import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { Controller, Get, Logger } from '@nestjs/common'
import { lastValueFrom, of } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoggingInterceptor } from '../logging.interceptor.js'
import { SkipRequestLog } from '../skip-request-log.decorator.js'

@Controller('noisy')
@SkipRequestLog()
class ProbedController {
  @Get()
  check() {}
}

@Controller('ordinary')
class OrdinaryController {
  @Get()
  list() {}
}

function contextFor(controller: new () => object, handler: () => void): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/x' }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext
}

const next: CallHandler = { handle: () => of({ ok: true }) }

describe('loggingInterceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs a request to an ordinary controller', async () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})

    await lastValueFrom(new LoggingInterceptor().intercept(contextFor(OrdinaryController, OrdinaryController.prototype.list), next))

    expect(debug).toHaveBeenCalledWith(expect.stringContaining('GET /x 200'))
  })

  it('never logs the response body, which can carry credentials', async () => {
    const levels = ['log', 'debug', 'verbose', 'warn', 'error', 'fatal'] as const
    const spies = levels.map(level => vi.spyOn(Logger.prototype, level).mockImplementation(() => {}))
    const secretNext: CallHandler = { handle: () => of({ apikey: 'secret-device-key' }) }

    await lastValueFrom(new LoggingInterceptor().intercept(contextFor(OrdinaryController, OrdinaryController.prototype.list), secretNext))

    const logged = spies.flatMap(spy => spy.mock.calls.flat()).map(String).join('\n')
    expect(logged).toContain('GET /x 200')
    expect(logged).not.toContain('secret-device-key')
  })

  it('does not log a request to a controller marked @SkipRequestLog()', async () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})

    const body = await lastValueFrom(new LoggingInterceptor().intercept(contextFor(ProbedController, ProbedController.prototype.check), next))

    expect(body).toEqual({ ok: true })
    expect(debug).not.toHaveBeenCalled()
  })
})
