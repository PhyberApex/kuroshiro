import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { Controller, Get, Logger } from '@nestjs/common'
import { lastValueFrom, of, throwError } from 'rxjs'
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

function contextFor(controller: new () => object, handler: () => void, request = { method: 'GET', url: '/x', path: '/x' }): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
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

  // `path` is what Express derives from `url` and routes on.
  it.each([
    ['/api/webhook/secret-webhook-token', '/api/webhook/secret-webhook-token'],
    ['/api/webhook/secret-webhook-token?source=ci', '/api/webhook/secret-webhook-token'],
    ['/api/webhook/secret-webhook-token/', '/api/webhook/secret-webhook-token/'],
    ['/API/Webhook/secret-webhook-token', '/API/Webhook/secret-webhook-token'],
    ['http://kuroshiro.local/api/webhook/secret-webhook-token', '/api/webhook/secret-webhook-token'],
  ])('logs a webhook request to %s without its Webhook Token', async (url, path) => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})

    await lastValueFrom(new LoggingInterceptor().intercept(contextFor(OrdinaryController, OrdinaryController.prototype.list, { method: 'POST', url, path }), next))

    const logged = debug.mock.calls.flat().map(String).join('\n')
    expect(logged).toContain('POST /api/webhook/[redacted]')
    expect(logged).not.toContain('secret-webhook-token')
  })

  it('logs a failed webhook request without its Webhook Token', async () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})
    const failing: CallHandler = { handle: () => throwError(() => Object.assign(new Error('Not Found'), { status: 404 })) }

    await expect(lastValueFrom(new LoggingInterceptor().intercept(contextFor(OrdinaryController, OrdinaryController.prototype.list, { method: 'GET', url: '/api/webhook/secret-webhook-token', path: '/api/webhook/secret-webhook-token' }), failing))).rejects.toThrow('Not Found')

    const logged = debug.mock.calls.flat().map(String).join('\n')
    expect(logged).toContain('GET /api/webhook/[redacted] 404')
    expect(logged).not.toContain('secret-webhook-token')
  })

  it('does not log a request to a controller marked @SkipRequestLog()', async () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})

    const body = await lastValueFrom(new LoggingInterceptor().intercept(contextFor(ProbedController, ProbedController.prototype.check), next))

    expect(body).toEqual({ ok: true })
    expect(debug).not.toHaveBeenCalled()
  })
})
