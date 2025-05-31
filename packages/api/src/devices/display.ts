export class Display {
  filename: string
  firmware_url: string
  image_url: string
  refresh_rate: number
  reset_firmware: boolean
  special_function: string
  update_firmware: boolean

  constructor(display: Display) {
    Object.assign(this, display)
  }
}
