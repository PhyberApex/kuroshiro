import type { InstanceLimits } from 'kuroshiro-shared'

const MIB = 1024 * 1024

// Each ceiling sits well above what the matching upload carries in practice (an ESP32 OTA image, a Recipe zip,
// a full-size photo, an archive holding every File Screen image) and below what would exhaust memory.
export const UPLOAD_LIMITS: InstanceLimits = {
  imageUploadBytes: 25 * MIB,
  firmwareUploadBytes: 8 * MIB,
  archiveUploadBytes: 256 * MIB,
  pluginImportBytes: 25 * MIB,
  webhookBodyBytes: 1 * MIB,
}

export const JSON_BODY_BYTES = 100 * 1024
