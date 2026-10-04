export const INSTANCE_PATH = '/instance'

/** The path of an Instance page from the path of its route under the Instance frame: `firmware` is `/instance/firmware`. */
export const instancePagePath = (page: string) => `${INSTANCE_PATH}/${page}`

export const FIRMWARE_PATH = instancePagePath('firmware')
export const UPLOAD_FIRMWARE_PATH = `${FIRMWARE_PATH}/upload`
export const DEVICE_MODELS_PATH = instancePagePath('models')
export const HOUSEKEEPING_PATH = instancePagePath('housekeeping')

/** The sections of Instance Settings other pages link to, each by the fragment it answers to. */
export const ALERT_RULES_PATH = `${instancePagePath('settings')}#alert-rules`
export const NOTIFICATIONS_PATH = `${instancePagePath('settings')}#notifications`
export const RETENTION_PATH = `${instancePagePath('settings')}#retention`
