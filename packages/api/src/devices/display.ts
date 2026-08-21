export class Display {
  action: string
  filename: string
  firmware_url: string
  image_url: string
  refresh_rate: number
  reset_firmware: boolean
  special_function: string
  temperature_profile: string
  update_firmware: boolean

  constructor(display: Display) {
    Object.assign(this, display)
  }
}
