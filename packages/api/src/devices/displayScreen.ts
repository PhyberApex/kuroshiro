export class DisplayScreen {
  filename: string
  image_url: string
  refresh_rate: number
  rendered_at: Date

  constructor(display: DisplayScreen) {
    Object.assign(this, display)
  }
}
