import { DEVICES_PATH } from '@/shell/barEntries'

/** The Device's Screens view, which the paths of its other pages start with. */
export const devicePath = (deviceId: string) => `${DEVICES_PATH}/${deviceId}`

export const deviceSettingsPath = (deviceId: string) => `${devicePath(deviceId)}/settings`

export const deviceLogsPath = (deviceId: string) => `${devicePath(deviceId)}/logs`

export const addScreenPath = (deviceId: string) => `${devicePath(deviceId)}/screens/new`

export const editHtmlPath = (deviceId: string, screenId: string) => `${devicePath(deviceId)}/screens/${screenId}/html`
