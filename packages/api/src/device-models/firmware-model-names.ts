/**
 * Maps the board names the TRMNL firmware sends in its `Model` header
 * (`DEVICE_MODEL` in the firmware's config.h) to the model names used by
 * usetrmnl.com/api/models. Boards without a clear upstream counterpart are
 * left out on purpose and fall back to a dimension match.
 *
 * The colour OG kit reports `og_4clr` (`og_gen2_4clr` for gen 2). An OG
 * B/W/R/Y on firmware older than the `og_4clr` build still reports `og`, so
 * it resolves to `og_plus` and must be switched to `og_bwry` manually in the
 * UI (Terminus has the same limitation).
 */
export const FIRMWARE_MODEL_NAMES: Record<string, string> = {
  'og': 'og_plus',
  'og_gen2': 'og_plus',
  'og_4clr': 'og_bwry',
  'og_gen2_4clr': 'og_bwry',
  'x': 'v2',
  'paper_s3': 'm5_paper_s3',
  'm5_papers3': 'm5_paper_s3',
  'reterminal_e1001': 'seeed_e1001',
  'reterminal_e1002': 'seeed_e1002',
  'reterminal_e1003': 'seeed_e1003',
  'seeed_esp32c3': 'seeed_e1001',
  'seeed_esp32s3': 'seeed_e1002',
  'xiao_epaper_display': 'og_plus',
  'xteink_x4': 'xteink_x4',
  'sensoria_c5': 'v2',
  'sensoria_s3': 'v2',
  'lilygo': 'v2',
  'lilygo_t5pro': 'v2',
  'reterminal_e1004': 'seeed_e1004',
  'waveshare': 'og_plus',
  'gen-2': 'og_plus',
}

export const FALLBACK_MODEL_NAME = 'og_plus'
