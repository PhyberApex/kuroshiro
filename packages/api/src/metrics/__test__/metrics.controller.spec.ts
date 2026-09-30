import type { MetricsService } from '../metrics.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { MetricsController } from '../metrics.controller.js'

describe('metricsController', () => {
  let controller: MetricsController
  let service: { render: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = { render: vi.fn() }
    controller = new MetricsController(asService<MetricsService>(service))
  })

  it('returns the rendered Prometheus text from the service', async () => {
    service.render.mockResolvedValue('# HELP kuroshiro_alerts_active ...\n')

    const result = await controller.getMetrics()

    expect(result).toBe('# HELP kuroshiro_alerts_active ...\n')
    expect(service.render).toHaveBeenCalled()
  })
})
