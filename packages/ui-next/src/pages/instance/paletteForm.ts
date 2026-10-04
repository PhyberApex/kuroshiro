import type { CreateCustomPaletteInput, CustomPaletteFrameworkClass, DeviceModelRead, DeviceReference, PaletteRead } from 'kuroshiro-shared'
import type { SelectOption } from '@/components/selectOption'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES, HEX_COLOR_PATTERN } from 'kuroshiro-shared'
import { fieldErrorsOf, isRefusal } from '@/api/client'
import { listed } from '@/patterns/listed'
import { PALETTE_FAMILIES } from './paletteFamilies'

export interface PaletteDraft {
  name: string
  frameworkClass: CustomPaletteFrameworkClass
  colours: string[]
}

export interface PaletteProblems {
  name?: string
  /** One sentence for the whole list of colours. */
  colours?: string
  /** The places in the list of the colours that are not `#RRGGBB`. */
  invalidColours: number[]
}

const FIRST_FAMILY = PALETTE_FAMILIES[0].frameworkClass
const BLACK_AND_WHITE = ['#000000', '#FFFFFF']

/** The colours of TRMNL's Palette of a family: where a new custom Palette in it starts. */
function trmnlColours(frameworkClass: CustomPaletteFrameworkClass, palettes: PaletteRead[]) {
  return palettes.find(palette => palette.kind === 'official' && palette.frameworkClass === frameworkClass && palette.colors)?.colors ?? undefined
}

function isFamily(frameworkClass: string): frameworkClass is CustomPaletteFrameworkClass {
  return (CUSTOM_PALETTE_FRAMEWORK_CLASSES as readonly string[]).includes(frameworkClass)
}

/** What the form holds when it opens: the Palette as it is, or a new one in the first family, starting from TRMNL's colours for it. */
export function draftOf(palette: PaletteRead | undefined, palettes: PaletteRead[]): PaletteDraft {
  if (palette) {
    const frameworkClass = isFamily(palette.frameworkClass) ? palette.frameworkClass : FIRST_FAMILY
    return { name: palette.name, frameworkClass, colours: [...palette.colors ?? []] }
  }
  return { name: '', frameworkClass: FIRST_FAMILY, colours: [...trmnlColours(FIRST_FAMILY, palettes) ?? BLACK_AND_WHITE] }
}

function sameColours(one: string[], other: string[] | undefined) {
  return other !== undefined && one.length === other.length && one.every((colour, index) => colour === other[index])
}

/** The colours after a change of family: TRMNL's for the new family while the admin has not changed those of the old one. */
export function nextDraftColours({ frameworkClass, colours }: PaletteDraft, nextFamily: CustomPaletteFrameworkClass, palettes: PaletteRead[]) {
  const untouched = sameColours(colours, trmnlColours(frameworkClass, palettes))
  const next = trmnlColours(nextFamily, palettes)
  return untouched && next ? [...next] : colours
}

export function familyOptions(): SelectOption<CustomPaletteFrameworkClass>[] {
  return PALETTE_FAMILIES.map(family => ({ value: family.frameworkClass, label: `${family.name} · ${family.id}` }))
}

const INVALID_COLOUR = 'Enter a colour like #B53A30.'

/** What keeps the form from being sent. */
export function draftProblems({ name, colours }: PaletteDraft): PaletteProblems {
  const invalidColours = colours.flatMap((colour, index) => HEX_COLOR_PATTERN.test(colour.trim()) ? [] : [index])
  const colourProblem = colours.length === 0
    ? 'A Palette needs at least one colour.'
    : invalidColours.length > 0 ? INVALID_COLOUR : undefined
  return {
    ...(name.trim() ? {} : { name: 'A Palette needs a name.' }),
    ...(colourProblem ? { colours: colourProblem } : {}),
    invalidColours,
  }
}

export function paletteInput({ name, frameworkClass, colours }: PaletteDraft): CreateCustomPaletteInput {
  return { name: name.trim(), frameworkClass, colors: colours.map(colour => colour.trim()) }
}

/** The field a refused save is about, with the refusal worded for it. No field for a refusal that is about none. */
export function paletteRefusedAt(error: unknown, { name }: PaletteDraft): PaletteProblems {
  if (isRefusal(error, 'palette-name-taken'))
    return { name: `There is already a custom Palette called ${name.trim()}. Give this one a name that tells them apart.`, invalidColours: [] }
  const { name: nameRefused, colors: coloursRefused } = fieldErrorsOf(error)
  return {
    ...(nameRefused ? { name: nameRefused } : {}),
    ...(coloursRefused ? { colours: coloursRefused } : {}),
    invalidColours: [],
  }
}

/** The line beside the buttons of a Palette Devices use. */
export function savingConverts(usedBy: DeviceReference[]) {
  return usedBy.length === 0 ? undefined : `Saving converts ${listed(usedBy.map(device => device.name))}'s stored images again.`
}

const counted = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`

interface GoingBack {
  /** The name of the Palette the Devices go back to, when the page knows it. */
  fallback: string | undefined
  names: string[]
}

/** The Devices of `usedBy` by the Palette each goes back to, in the order they come. */
function byFallback(usedBy: DeviceReference[], models: DeviceModelRead[], palettes: PaletteRead[]) {
  const fallbackOf = (device: DeviceReference) => {
    const id = models.find(model => model.usedBy.some(user => user.id === device.id))?.defaultPaletteId
    return palettes.find(palette => palette.id === id)?.name
  }
  return usedBy.reduce<GoingBack[]>((groups, device) => {
    const fallback = fallbackOf(device)
    const group = groups.find(candidate => candidate.fallback === fallback)
    return group
      ? groups.map(candidate => candidate === group ? { ...group, names: [...group.names, device.name] } : candidate)
      : [...groups, { fallback, names: [device.name] }]
  }, [])
}

function goesBack({ fallback, names }: GoingBack) {
  const one = names.length === 1
  return `${listed(names)}, which ${one ? 'goes back to its' : 'go back to their'} Device Model's richest Palette${fallback ? `, ${fallback}` : ''}.`
}

/** What the confirmation of deleting a custom Palette says: Devices on it go back to their Device Model's default Palette, as the server does. */
export function deletionWording({ name, colors, usedBy }: PaletteRead, models: DeviceModelRead[], palettes: PaletteRead[]) {
  const converted = usedBy.length === 1 ? 'Its stored images are converted again.' : 'Their stored images are converted again.'
  return {
    title: `Delete the Palette ${name}?`,
    lost: `The custom Palette and its ${counted(colors?.length ?? 0, 'colour')}.`,
    stays: usedBy.length === 0
      ? 'Everything else. No Device uses it.'
      : [...byFallback(usedBy, models, palettes).map(goesBack), converted].join(' '),
  }
}
