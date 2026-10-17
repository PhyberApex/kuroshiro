/** The `Update-Source` values the firmware's own GPIO-wake check treats as a button press. Every other value, and a missing header, is a timer wake. */
export const BUTTON_WAKE_SOURCES = ['button', 'EXT0', 'EXT1'] as const

/** Whether a Device's `Update-Source` header says a button press woke it. Case-sensitive: the firmware sends `EXT0` as is. */
export function isButtonWake(wakeSource: string | null | undefined): boolean {
  return BUTTON_WAKE_SOURCES.includes(wakeSource)
}

/** What `/api/setup` answers a Device that announces itself. */
export interface SetupAnswer {
  status: number
  image_url: string
  message: string
  api_key: string
  friendly_id: string
}

/** What `/api/display` answers a poll. */
export interface DisplayAnswer {
  action: string
  filename: string
  firmware_url: string | null
  image_url: string
  refresh_rate: number
  reset_firmware: boolean
  special_function: string
  temperature_profile: string
  update_firmware: boolean
}
