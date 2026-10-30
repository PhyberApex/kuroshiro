// Bump whenever the Configuration Archive shape (manifest.json or any *.json file's fields) changes.
// Configuration Import refuses an archive whose manifest.json carries a version it does not list (ADR-0021).
// v1 is what Kuroshiro up to 0.17.x exports.
// v2 (ADR-0027) adds settings.json, carrying the overridden Instance Settings.
// v3 (ADR-0032) carries Field Values on the Plugin entry instead of the Assignment entry and has no Plugin Variables.
// v4 (ADR-0041) adds the Plugin's frameworkVersion; an older archive reads as null.
// v5 (ADR-0045) adds dither to every Screen and Plugin entry; an older archive reads as dithered.
// v6 (ADR-0046) adds rotationMode to every Device entry; an older archive reads as automatic.
// v7 (#1669) adds snapshotTakenAt to every Plugin entry and a File Screen's upload facts to every Screen entry; an older archive reads them as null.
export const CONFIG_SCHEMA_VERSION = 7

// The older versions Configuration Import still reads: their Plugin Variables and per-Assignment Field Values are dropped with a warning (ADR-0032).
export const LEGACY_CONFIG_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([1, 2])

export const IMPORTABLE_CONFIG_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([...LEGACY_CONFIG_SCHEMA_VERSIONS, 3, 4, 5, 6, CONFIG_SCHEMA_VERSION])

// An archive older than this has no settings.json, which reads as no overridden Instance Settings.
export const FIRST_CONFIG_SCHEMA_VERSION_WITH_SETTINGS = 2
