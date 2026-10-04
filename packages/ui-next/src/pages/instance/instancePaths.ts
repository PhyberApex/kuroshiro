export const INSTANCE_PATH = '/instance'

/** The path of an Instance page from the path of its route under the Instance frame: `firmware` is `/instance/firmware`. */
export const instancePagePath = (page: string) => `${INSTANCE_PATH}/${page}`

export const FIRMWARE_PATH = instancePagePath('firmware')
export const HOUSEKEEPING_PATH = instancePagePath('housekeeping')
