import type { HttpTestApp } from '../../test/httpApp.js'
import type { Alert } from '../entities/alert.entity.js'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockRepository } from '../../test/mockRepository.js'
import { AlertsController } from '../alerts.controller.js'
import { AlertsService } from '../alerts.service.js'
import { Alert as AlertEntity } from '../entities/alert.entity.js'
import { NotificationSenderService } from '../notification-sender.service.js'

describe('pOST /api/alerts/test-notification', () => {
  let http: HttpTestApp
  const sender = { send: vi.fn(), isConfigured: vi.fn() }

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [AlertsController],
      providers: [
        AlertsService,
        { provide: getRepositoryToken(AlertEntity), useValue: createMockRepository<Alert>() },
        { provide: NotificationSenderService, useValue: sender },
      ],
    })
  })

  afterAll(async () => {
    await http.app.close()
  })

  const sendTestNotification = () => http.request('/api/alerts/test-notification', { method: 'POST' })

  it('answers 200 once Apprise accepted the Test Notification', async () => {
    sender.send.mockResolvedValue(true)

    const response = await sendTestNotification()

    expect(response.status).toBe(200)
  })

  it('refuses with 400 notifications-off while Notifications are not set up', async () => {
    sender.send.mockResolvedValue(false)
    sender.isConfigured.mockReturnValue(false)

    const response = await sendTestNotification()

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ statusCode: 400, code: 'notifications-off' })
  })

  it('refuses with 503 notification-failed when Apprise did not accept it', async () => {
    sender.send.mockResolvedValue(false)
    sender.isConfigured.mockReturnValue(true)

    const response = await sendTestNotification()

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ statusCode: 503, code: 'notification-failed' })
  })
})
