/**
 * Maps the board names the TRMNL firmware sends in its `Model` header
 * (`DEVICE_MODEL` in the firmware's config.h) to the model names used by
 * usetrmnl.com/api/models. Boards without a clear upstream counterpart are
 * left out on purpose and fall back to a dimension match.
 */
export const FIRMWARE_MODEL_NAMES: Record<string, string> = {
  og: 'og_plus',
  og_gen2: 'og_plus',
  x: 'v2',
  paper_s3: 'm5_paper_s3',
  reterminal_e1001: 'seeed_e1001',
  reterminal_e1002: 'seeed_e1002',
  reterminal_e1003: 'seeed_e1003',
  seeed_esp32c3: 'seeed_e1001',
  seeed_esp32s3: 'seeed_e1002',
  xiao_epaper_display: 'og_plus',
  xteink_x4: 'xteink_x4',
}

export const FALLBACK_MODEL_NAME = 'og_plus'
