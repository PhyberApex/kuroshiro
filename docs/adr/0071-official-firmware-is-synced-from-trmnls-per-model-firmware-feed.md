# Official Firmware is synced from TRMNL's per-model firmware feed

ADR-0065 formatted each folder's binary URL from the one version `usetrmnl.com/api/firmware/latest` names, because nothing advertised the per-model binaries. Checking #1304 on 2026-10-27 found that TRMNL now does: `GET https://usetrmnl.com/api/firmware` returns `{ data: [{ model, label, chip_family, latest, url }] }`, one entry per hardware model, each with its own binary URL. The `model` keys are the ones `/api/models` uses (`og_png`, `og_plus`, `og_bwry`, `v2`), so they are Kuroshiro's Device Model keys. The OG entries share one URL (`trmnl_og/FW<version>.bin`); B/W/R/Y and X have their own folder each. This is the advertised source #1304 waited for, and it supersedes ADR-0065's formula while keeping its shape.

**The sync reads the feed and stores one `official-synced` row per distinct binary URL, compatible with every model whose entry points at it.** The row's lineage key stays the folder, read from the URL's path (`trmnl_og`, `trmnl_x`), so existing rows and the per-folder uniqueness and deprecation of ADR-0065 carry over unchanged. Each entry names its own version, so folders may lag one another and a folder missing a version is no longer a case to skip: every advertised URL is expected to download, and a failure fails the sync. `/api/firmware/latest` is no longer called.

The maintainer settled the forks:

- **Compatibility comes from the feed, not a map in the code.** The hardcoded folder-to-models map of ADR-0065 goes; on every sync the official rows of a folder are realigned to the models the feed currently lists for it, as before.
- **`og_bwry` is still excluded, as a deny-list.** OTA on OG B/W/R/Y Devices still fails or loops (usetrmnl/trmnl-firmware#538, tracked in #1328). An excluded model is dropped from every entry, and an entry left with no model is not synced at all. Removing the exclusion is #1573.
- **An unknown model key is kept.** A model Kuroshiro has no Device Model for yet still names a real binary; the row stores the key, and the compatibility check at assignment already refuses any Device whose Model is not in the set. A later Device Model sync makes the key resolvable without re-syncing Firmware.
- **The feed's `label` and `chip_family` are not stored.** Kuroshiro names models by its own Device Models.

## Considered options

- **Keep the folder formula** of ADR-0065 and only use the feed to discover folders. Rejected: the feed is the source of truth for both the URL and the version, so formatting either from it reintroduces a guess the feed already answers.
- **One row per feed entry**, so `og_png` and `og_plus` each get a row of the same binary. Rejected: the two rows would hold the same file and checksum and show as two Firmware of one version, and ADR-0065's rows are per folder already.
- **Keep calling `/api/firmware/latest`** as a fallback when the feed fails. Rejected: two sources mean two ways to disagree about the latest version; a failed feed request fails the sync and is retried next run, as any sync failure is.

## Consequences

- Syncing a new hardware family TRMNL adds to the feed needs no code change; excluding one does.
- The Firmware Library's last line names the feed and the Device Models it currently carries, taken from the synced rows rather than a fixed list, minus the excluded ones.
- A version shows once per folder on the Firmware page, as under ADR-0065.
- BYOD models (Seeed, Sticky, Xteink) are not in the feed and still need an upload; #1304 stays the place to track that.
