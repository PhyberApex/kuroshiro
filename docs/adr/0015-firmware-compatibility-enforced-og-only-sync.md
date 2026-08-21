# Firmware compatibility is enforced against Device Model; official sync only ever produces an OG binary

While grilling issue #781, we probed `usetrmnl.com/api/firmware/latest` directly — the same public, unauthenticated endpoint Terminus's own sync job hits. It always returns the OG binary (`trmnl_og/FW*.bin`) regardless of query params or headers; there is no public way to fetch the V2/BWRY variants through it. Of the roughly 50 Device Models TRMNL's `/api/models` lists, only four are actual OTA-capable first-party hardware (`v2`, `og_png`, `og_plus`, `og_bwry`, all `kind: "trmnl"`) — everything else (BYOD/Kindle/Tidbyt) never receives a firmware push at all. Because the sync source can't disambiguate hardware variants, and because flashing the wrong variant's binary can brick a Device, every Firmware carries an optional `compatibleModels` set (empty means universal) that's enforced as a hard block — not a warning — whenever a Firmware is assigned to a Device. The daily-synced row defaults its `compatibleModels` to the three OG variants, since the URL path (`trmnl_og/`) is the only concrete evidence of what it actually is. This deliberately improves on Terminus's own `Firmware` model, which carries no link to its `model` table at all — it treats firmware as a single flat, undifferentiated resource.

## Considered options

- **Match Terminus: no compatibility link.** Rejected: Kuroshiro already has the Device Model concept Terminus's schema lacks; not using it here to prevent an obviously-wrong flash would be leaving a real guardrail on the table.
- **Try to reverse-engineer per-model official binaries** (e.g. guessing S3 paths for other variants). Rejected: no public, documented way to do this; the differentiation logic clearly lives in TRMNL's closed-source Core, reached only through the authenticated, per-account `/api/display` flow.

## Consequences

- V2/BWRY official firmware is unreachable via the sync job. Getting it into Kuroshiro requires an admin sourcing the binary themselves (e.g. building from `usetrmnl/firmware`) and uploading it as `custom`, tagged with the correct compatible models.
- If TRMNL ever exposes per-model official binaries publicly, the sync job only needs to populate `compatibleModels` correctly per row — the assignment-time enforcement itself doesn't change.
