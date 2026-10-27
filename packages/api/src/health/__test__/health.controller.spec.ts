import type { HttpTestApp } from '../../test/httpApp.js'
import { ServiceUnavailableException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpTestApp } from '../../test/httpApp.js'
import { asService } from '../../test/mockService.js'
import { HealthController } from '../health.controller.js'

describe('healthController', () => {
  let http: HttpTestApp
  let dataSource: { query: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    dataSource = { query: vi.fn() }
    http = await createHttpTestApp({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: dataSource }],
    })
  })

  afterEach(async () => {
    await http.app.close()
  })

  it('answers 200 at /health, outside the /api prefix, when the database answers', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }])

    const res = await http.request('/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', database: 'ok' })
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1')
  })

  it('answers 503 with the bare body, not the admin error envelope, when the query throws', async () => {
    dataSource.query.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const res = await http.request('/health')

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error', database: 'unreachable' })
  })
})

describe('healthController timeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports the database unreachable when the query takes longer than 2 seconds', async () => {
    vi.useFakeTimers()
    const controller = new HealthController(asService<DataSource>({ query: vi.fn(() => new Promise(() => {})) }))

    const answer = expect(controller.check()).rejects.toThrow(ServiceUnavailableException)
    await vi.advanceTimersByTimeAsync(2000)

    await answer
  })

  it('still answers 200 when the query returns just inside 2 seconds', async () => {
    vi.useFakeTimers()
    const controller = new HealthController(asService<DataSource>({
      query: vi.fn(() => new Promise(resolve => setTimeout(resolve, 1999, [{}]))),
    }))

    const result = controller.check()
    await vi.advanceTimersByTimeAsync(1999)

    await expect(result).resolves.toEqual({ status: 'ok', database: 'ok' })
  })
})
