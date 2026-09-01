import type { Mock } from 'vitest'
import { vi } from 'vitest'

export interface MockDeviceSensorsService {
  findForDevice: Mock
  syncFromHeader: Mock
}

export function createMockDeviceSensorsService(): MockDeviceSensorsService {
  return {
    findForDevice: vi.fn(),
    syncFromHeader: vi.fn(),
  }
}

/** Default behaviour after `vi.resetAllMocks()`: no readings, sync resolves without doing anything observable. */
export function primeMockDeviceSensorsService(mock: MockDeviceSensorsService) {
  mock.findForDevice.mockResolvedValue([])
  mock.syncFromHeader.mockResolvedValue(undefined)
}
