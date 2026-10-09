// Bump whenever the Configuration Archive shape (manifest.json or any *.json file's fields) changes.
// Configuration Import refuses an archive whose manifest.json carries a version it does not list (ADR-0021).
// v1 is what Kuroshiro up to 0.17.x exports.
// v2 (ADR-0027) adds settings.json, carrying the overridden Instance Settings.
// v3 (ADR-0032) carries Field Values on the Plugin entry instead of the Assignment entry and has no Plugin Variables.
export const CONFIG_SCHEMA_VERSION = 3

// The older versions Configuration Import still reads: their Plugin Variables and per-Assignment Field Values are dropped with a warning (ADR-0032).
export const LEGACY_CONFIG_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([1, 2])

export const IMPORTABLE_CONFIG_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([...LEGACY_CONFIG_SCHEMA_VERSIONS, CONFIG_SCHEMA_VERSION])

// An archive older than this has no settings.json, which reads as no overridden Instance Settings.
export const FIRST_CONFIG_SCHEMA_VERSION_WITH_SETTINGS = 2
