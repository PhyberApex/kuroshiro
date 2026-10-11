import { Logger } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { ApiException } from '../api.exception.js'
import { syncOr502 } from '../sync-or-502.js'

describe('syncOr502', () => {
  it('answers what the sync ran with', async () => {
    const logger = new Logger('test')
    await expect(syncOr502(logger, 'firmware', async () => 'synced')).resolves.toBe('synced')
  })

  it('maps a failed sync to a 502 upstream-unreachable worded with what, logging the same message', async () => {
    const logger = new Logger('test')
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    const refusal = await syncOr502(logger, 'device models', async () => {
      throw new Error('TRMNL models request failed: 502 Bad Gateway')
    }).catch((error: unknown) => error)

    expect(refusal).toBeInstanceOf(ApiException)
    expect(refusal).toMatchObject({
      code: 'upstream-unreachable',
      details: { reason: 'TRMNL models request failed: 502 Bad Gateway' },
    })
    expect((refusal as ApiException).getStatus()).toBe(502)
    expect((refusal as ApiException).getResponse()).toMatchObject({ message: 'Could not sync device models from TRMNL: TRMNL models request failed: 502 Bad Gateway' })
    expect(errorSpy).toHaveBeenCalledWith('Could not sync device models from TRMNL: TRMNL models request failed: 502 Bad Gateway')
  })
})
