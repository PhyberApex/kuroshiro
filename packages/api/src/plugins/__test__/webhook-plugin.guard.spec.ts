import type { ExecutionContext } from '@nestjs/common'
import type { Plugin } from '../entities/plugin.entity'
import { UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { makePlugin } from '../../test/fixtures'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { asService } from '../../test/mockService'
import { WebhookPluginGuard } from '../guards/webhook-plugin.guard'

describe('webhookPluginGuard', () => {
  let guard: WebhookPluginGuard
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let request: { params: { token?: string }, plugin?: Plugin }

  const plugin = makePlugin({ id: 'plugin-1', kind: 'Webhook', webhookToken: 'token-abc' })

  function contextFor(token?: string): ExecutionContext {
    request = { params: token === undefined ? {} : { token } }
    return asService<ExecutionContext>({
      switchToHttp: () => ({ getRequest: () => request }),
    })
  }

  beforeEach(() => {
    pluginRepo = createMockRepository<Plugin>()
    pluginRepo.findOne.mockImplementation(async (options) => {
      const where = options.where
      const webhookToken = where && !Array.isArray(where) ? where.webhookToken : undefined
      return webhookToken === plugin.webhookToken ? plugin : null
    })
    guard = new WebhookPluginGuard(asRepository(pluginRepo))
  })

  it('resolves the Plugin from its Webhook Token and attaches it to the request', async () => {
    await expect(guard.canActivate(contextFor('token-abc'))).resolves.toBe(true)

    expect(request.plugin).toBe(plugin)
  })

  it('only resolves Webhook-kind Plugins', async () => {
    await guard.canActivate(contextFor('token-abc'))

    expect(pluginRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { webhookToken: 'token-abc', kind: 'Webhook' } }),
    )
  })

  it('rejects an unknown Webhook Token', async () => {
    await expect(guard.canActivate(contextFor('nope'))).rejects.toThrow(UnauthorizedException)

    expect(request.plugin).toBeUndefined()
  })

  it('rejects a missing Webhook Token without touching Plugin data', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toThrow(UnauthorizedException)

    expect(pluginRepo.findOne).not.toHaveBeenCalled()
  })
})
