// Bump whenever the Configuration Archive shape (manifest.json or any *.json file's fields) changes.
// Configuration Import refuses an archive whose manifest.json carries a version it does not list (ADR-0021).
// v2 (ADR-0027) adds settings.json, carrying the overridden Instance Settings.
// v3 (ADR-0032) carries Field Values on the Plugin entry instead of the Assignment entry and has no Plugin Variables.
export const CONFIG_SCHEMA_VERSION = 3

// The one older version Configuration Import still reads (ADR-0032).
export const PREVIOUS_CONFIG_SCHEMA_VERSION = 2
