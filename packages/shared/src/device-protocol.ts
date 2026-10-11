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
