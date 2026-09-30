// Bump whenever the Configuration Archive shape (manifest.json or any *.json file's fields) changes.
// Configuration Import refuses an archive whose manifest.json carries a different value (ADR-0021).
// v2 (ADR-0027) adds settings.json, carrying the overridden Instance Settings.
export const CONFIG_SCHEMA_VERSION = 2
