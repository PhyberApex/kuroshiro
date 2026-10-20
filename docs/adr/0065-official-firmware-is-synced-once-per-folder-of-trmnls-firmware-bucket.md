# Official Firmware is synced once per folder of TRMNL's firmware bucket

ADR-0015 rejected fetching per-model official binaries by "guessing S3 paths for other variants": no public, documented way existed, and `usetrmnl.com/api/firmware/latest` only ever names the OG build. Issue #1455 found that the guess is no longer a guess. TRMNL's own `trmnl-api` gem (0.22, `endpoints/firmware/latest.rb`) takes the version from `/api/firmware/latest` and formats `https://trmnl-fw.s3.us-east-2.amazonaws.com/<folder>/FW<version>.bin`, and Terminus syncs `trmnl_og`, `trmnl_x` and `trmnl_bwry` that way. The pattern is encoded in TRMNL's own client library, which is exactly the ground ADR-0015 lacked, so this supersedes its "reverse-engineer per-model official binaries" rejection and the OG-only premise ADR-0029 built "latest official" on.

**`/api/firmware/latest` names the version; each folder Kuroshiro knows is downloaded at that version and stored as its own `official-synced` row**, carrying the folder and declaring the folder's Device Models compatible:

- `trmnl_og` → `og_png`, `og_plus`
- `trmnl_x` → `v2`

The maintainer settled the forks:

- **`trmnl_bwry` is left out.** OTA on OG B/W/R/Y Devices still fails or loops (usetrmnl/trmnl-firmware#538, tracked in #1328), and #1454 has to resolve those Devices to `og_bwry` before anything can be assigned to them safely. Adding the folder later is one line and its own issue.
- **The existing official rows stay as the `trmnl_og` lineage.** They are all the OG binary, so the migration gives them that folder; nothing is re-synced or re-downloaded.
- **Sync stays online-only.** There is no bundled firmware, as before.

Each folder is its own lineage. A folder that already holds the version is skipped, and a new row deprecates only the previous row of its folder. A folder without the version (a 404) is logged and skipped, so the others still sync and the missing one is tried again on the next run; any other download failure fails the sync as before. A version a custom Firmware holds is still not synced at all. A version is unique among custom Firmware and per folder among official Firmware, not across the table.

"Latest official" (ADR-0029) becomes per Device Model: the newest non-deprecated `official-synced` row the Device's Model is compatible with. The policy on a new row is unchanged, since it already only reaches that row's compatible Devices. "Catch up now" gives each Device the latest official row of its own Model, compares the Device's reported version with that row's, and names the newest of those rows as the version it catches up to.

## Considered options

- **Keep waiting for `/api/firmwares`** (#1304). Rejected: nothing announces it, and Terminus and TRMNL's own client already rely on the folder pattern; a user reported OTA from Terminus working on an X.
- **One row per version, compatible with every folder's Models.** Rejected: the folders hold different binaries, and a row has one checksum and one file.

## Consequences

- A version shows once per folder on the Firmware page, told apart by the Device Models it fits.
- If a folder misses a version, its Devices stay on the folder's previous row until it appears, and catch-up compares them with that row's version.
- Official-synced rows are realigned per folder to the Device Models declared for it on every sync, as ADR-0015 already did for the one row.
