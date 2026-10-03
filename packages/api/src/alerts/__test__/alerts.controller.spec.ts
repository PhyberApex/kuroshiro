import type { AlertsList } from 'kuroshiro-shared'
import type { AlertsService } from '../alerts.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { AlertsController } from '../alerts.controller.js'

describe('alertsController', () => {
  let controller: AlertsController
  let service: { list: ReturnType<typeof vi.fn>, sendTestNotification: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = {
      list: vi.fn(),
      sendTestNotification: vi.fn(),
    }
    controller = new AlertsController(asService<AlertsService>(service))
  })

  describe('list', () => {
    it('calls service.list with the resolvedSince query param and returns the result', async () => {
      const mockList: AlertsList = { active: [], resolved: [] }
      vi.mocked(service.list).mockResolvedValue(mockList)

      const result = await controller.list({ resolvedSince: '2026-01-01T00:00:00.000Z' })

      expect(service.list).toHaveBeenCalledWith({ resolvedSince: '2026-01-01T00:00:00.000Z' })
      expect(result).toBe(mockList)
    })

    it('calls service.list with an empty query when no query param is given', async () => {
      const mockList: AlertsList = { active: [], resolved: [] }
      vi.mocked(service.list).mockResolvedValue(mockList)

      await controller.list({})

      expect(service.list).toHaveBeenCalledWith({})
    })
  })

  describe('sendTestNotification', () => {
    it('calls service.sendTestNotification and returns the result', async () => {
      const mockResult = { message: 'Test notification sent successfully.' }
      vi.mocked(service.sendTestNotification).mockResolvedValue(mockResult)

      const result = await controller.sendTestNotification()

      expect(service.sendTestNotification).toHaveBeenCalled()
      expect(result).toBe(mockResult)
    })
  })
})
