import { vi } from 'vitest'

export function createMockDeviceSensorsService() {
  return {
    findForDevice: vi.fn(),
    syncFromHeader: vi.fn(),
  }
}

export type MockDeviceSensorsService = ReturnType<typeof createMockDeviceSensorsService>

/** Default behaviour after `vi.resetAllMocks()`: no readings, sync resolves without doing anything observable. */
export function primeMockDeviceSensorsService(mock: MockDeviceSensorsService) {
  mock.findForDevice.mockResolvedValue([])
  mock.syncFromHeader.mockResolvedValue(undefined)
}
