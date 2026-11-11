import type {
  AssignmentManifestEntry,
  DeviceManifestEntry,
  FirmwareManifestEntry,
  PaletteManifestEntry,
  PluginManifestEntry,
  ScreenManifestEntry,
} from '../types.js'
import { isUUID } from 'class-validator'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES, HEX_COLOR_PATTERN, MERGE_STRATEGIES, PLUGIN_KINDS, ROTATION_MODES } from 'kuroshiro-shared'
import { CONFIG_ARCHIVE_FILES } from '../types.js'

/** The record lists of a Configuration Archive, each entry already known to be an object with a string id. */
export interface ArchiveEntryLists {
  plugins: PluginManifestEntry[]
  devices: DeviceManifestEntry[]
  screens: ScreenManifestEntry[]
  assignments: AssignmentManifestEntry[]
  palettes: PaletteManifestEntry[]
  firmware: FirmwareManifestEntry[]
}

/** Keyed by every Screen type, so a type added to the Screen is a compile error here until the import accepts it too. */
const SCREEN_TYPES = Object.keys({ file: true, external: true, html: true, plugin: true, mashup: true } satisfies Record<ScreenManifestEntry['type'], true>)

/** A Palette's grays are a level count ImageMagick builds a colormap of, so a byte's worth bounds them. */
const MAX_PALETTE_GRAYS = 256

/** What is wrong with one field of an entry, or null when nothing is. */
type FieldRule = (entry: Record<string, unknown>) => string | null

function uuid(key: string, { nullable = false } = {}): FieldRule {
  return entry => (nullable && (entry[key] === null || entry[key] === undefined)) || isUUID(entry[key]) ? null : `${key} is not a UUID`
}

function oneOf(key: string, values: readonly unknown[], { nullable = false, optional = false } = {}): FieldRule {
  return (entry) => {
    const value = entry[key]
    if ((nullable && value === null) || (optional && value === undefined) || values.includes(value))
      return null
    return `${key} is not one of ${values.join(', ')}`
  }
}

/** Each element of the list at `key` that is an object, checked by `rule` and named by its own key. */
function eachOf(key: string, rule: FieldRule, { nullable = false } = {}): FieldRule {
  return (entry) => {
    const list = entry[key]
    if (nullable && list === null)
      return null
    if (!Array.isArray(list))
      return `${key} is not a list`
    for (const [index, element] of list.entries()) {
      if (typeof element !== 'object' || element === null)
        return `${key}[${index}] is not an object`
      const violation = rule(element as Record<string, unknown>)
      if (violation)
        return `${key}[${index}].${violation}`
    }
    return null
  }
}

/** The object at `key`, checked by `rules`, when it is there at all. */
function nested(key: string, rules: FieldRule[]): FieldRule {
  return (entry) => {
    const value = entry[key]
    if (value === null || value === undefined)
      return null
    if (typeof value !== 'object' || Array.isArray(value))
      return `${key} is not an object`
    const violation = allOf(rules)(value as Record<string, unknown>)
    return violation && `${key}.${violation}`
  }
}

/** The first of `rules` the entry breaks. */
function allOf(rules: FieldRule[]): FieldRule {
  return (entry) => {
    for (const rule of rules) {
      const violation = rule(entry)
      if (violation)
        return violation
    }
    return null
  }
}

const hexColors: FieldRule = (entry) => {
  const { colors } = entry
  if (colors === null)
    return null
  return Array.isArray(colors) && colors.length > 0 && colors.every(color => typeof color === 'string' && HEX_COLOR_PATTERN.test(color)) ? null : 'colors are not each a #RRGGBB hex colour'
}

const grayLevels: FieldRule = (entry) => {
  const { grays } = entry
  return Number.isInteger(grays) && (grays as number) >= 1 && (grays as number) <= MAX_PALETTE_GRAYS ? null : `grays is not a whole number from 1 to ${MAX_PALETTE_GRAYS}`
}

/**
 * What every record the API itself creates keeps to, for the fields an import stores verbatim or builds a path
 * or an ImageMagick argument from: ids are UUIDs as the API generates them, a Palette's colours are hex colours
 * as its requests require, an enum is one of its values. A Device's `paletteId` is left alone, since it may name
 * an official Palette, whose id is no UUID.
 */
const RULES: { [K in keyof ArchiveEntryLists]: FieldRule[] } = {
  palettes: [uuid('id'), hexColors, grayLevels, oneOf('frameworkClass', CUSTOM_PALETTE_FRAMEWORK_CLASSES)],
  firmware: [uuid('id')],
  plugins: [
    uuid('id'),
    oneOf('kind', PLUGIN_KINDS),
    oneOf('mergeStrategy', MERGE_STRATEGIES, { nullable: true }),
    eachOf('dataSources', uuid('id')),
    eachOf('templates', uuid('id')),
    eachOf('fields', uuid('id')),
  ],
  devices: [uuid('id'), uuid('targetFirmwareId', { nullable: true }), oneOf('rotationMode', ROTATION_MODES, { optional: true })],
  assignments: [uuid('id'), uuid('deviceId'), uuid('pluginId')],
  screens: [
    uuid('id'),
    uuid('deviceId'),
    uuid('pluginId', { nullable: true }),
    uuid('devicePluginId', { nullable: true }),
    oneOf('type', SCREEN_TYPES),
    nested('schedule', [uuid('id')]),
    nested('mashupConfiguration', [uuid('id'), eachOf('slots', allOf([uuid('id'), uuid('pluginId')]))]),
  ],
}

/**
 * The first entry of the archive that breaks a rule, as `<file> entry <id>: <what is wrong>`, or null when every
 * entry keeps them. An id that is no UUID is the archive's own to name, so it is quoted as it stands.
 */
export function archiveEntryViolation(lists: ArchiveEntryLists): string | null {
  for (const key of Object.keys(RULES) as Array<keyof ArchiveEntryLists>) {
    for (const entry of lists[key] as unknown as Array<Record<string, unknown>>) {
      const violation = allOf(RULES[key])(entry)
      if (violation)
        return `${CONFIG_ARCHIVE_FILES[key]} entry ${JSON.stringify(entry.id)}: ${violation}`
    }
  }
  return null
}
