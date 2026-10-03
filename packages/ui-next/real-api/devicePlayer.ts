import { randomBytes } from 'node:crypto'

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

/** What a Device reports about itself on a poll; each key is sent as the header of the same name. */
export interface DeviceReport {
  'battery-voltage'?: string
  'fw-version'?: string
  'rssi'?: string
  'refresh-rate'?: string
  'width'?: string
  'height'?: string
  'model'?: string
  'sensors'?: string
}

export interface PlayedDevice {
  mac: string
  /** The answer to the setup request this Device was connected with. */
  setup: SetupAnswer
  /** Polls for the next Screen, as the firmware does on every wake. */
  display: (report?: DeviceReport) => Promise<DisplayAnswer>
  /** Sends log entries, as the firmware does after a failure. */
  log: (entries: Record<string, unknown>[]) => Promise<void>
}

function randomMac() {
  return [...randomBytes(6)].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(':')
}

async function answerOf<T>(response: Response): Promise<T> {
  if (!response.ok)
    throw new Error(`${response.url} answered ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

interface ConnectOptions {
  mac?: string
  firmwareVersion?: string
  /** The model name the firmware reports, such as `og_plus`. */
  model?: string
}

/**
 * Plays a Device against the real API over HTTP: announces it on `/api/setup` (which creates
 * the Device on first contact) and hands back what it needs to poll and to log.
 */
export async function connectDevice(baseUrl: string, { mac = randomMac(), firmwareVersion = '1.6.9', model }: ConnectOptions = {}): Promise<PlayedDevice> {
  const identity = { 'id': mac, 'fw-version': firmwareVersion, ...(model ? { model } : {}) }
  const endpoint = (path: string) => new URL(`api/${path}`, baseUrl)

  const setup = await answerOf<SetupAnswer>(await fetch(endpoint('setup'), { headers: identity }))

  return {
    mac,
    setup,
    display: async (report = {}) => answerOf<DisplayAnswer>(await fetch(endpoint('display'), {
      headers: { ...identity, 'access-token': setup.api_key, ...report },
    })),
    log: async (entries) => {
      const response = await fetch(endpoint('log'), {
        method: 'POST',
        headers: { 'id': mac, 'content-type': 'application/json' },
        body: JSON.stringify({ logs: entries }),
      })
      if (!response.ok)
        throw new Error(`${response.url} answered ${response.status}: ${await response.text()}`)
    },
  }
}
