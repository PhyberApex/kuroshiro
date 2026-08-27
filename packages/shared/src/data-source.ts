export const DATA_SOURCE_MODES = ['fetch', 'literal'] as const
export type DataSourceMode = typeof DATA_SOURCE_MODES[number]

// A plain object, array, or scalar — modeled shallowly (rather than as a fully
// recursive JSON type) because TypeORM's DeepPartial mapping over a
// self-referential union here blows past TS's recursion limit (TS2589).
export type DataSourceLiteralValue = Record<string, unknown> | unknown[] | string | number | boolean | null
