import type { ExecutionContext } from '@nestjs/common'
import { UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebhookPluginGuard } from '../guards/webhook-plugin.guard'

describe('webhookPluginGuard', () => {
  let guard: WebhookPluginGuard
  let pluginRepo: any
  let request: any

  const plugin = { id: 'plugin-1', kind: 'Webhook', webhookToken: 'token-abc' }

  function contextFor(token?: string): ExecutionContext {
    request = { params: token === undefined ? {} : { token } }
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
  }

  beforeEach(() => {
    pluginRepo = {
      findOne: vi.fn(async ({ where }: any) => (where.webhookToken === plugin.webhookToken ? plugin : null)),
    }
    guard = new WebhookPluginGuard(pluginRepo)
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
