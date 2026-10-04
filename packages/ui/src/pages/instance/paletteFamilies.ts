/**
 * The five Palette Families a custom Palette can be in, in the order a select offers them:
 * `frameworkClass` is what the API names a family by, `id` the short form shown beside its name.
 */
export const PALETTE_FAMILIES = [
  { frameworkClass: 'screen--color-3bwr', id: '3bwr', name: 'Black, white and red' },
  { frameworkClass: 'screen--color-3bwy', id: '3bwy', name: 'Black, white and yellow' },
  { frameworkClass: 'screen--color-4bwry', id: '4bwry', name: 'Black, white, red and yellow' },
  { frameworkClass: 'screen--color-6a', id: '6a', name: 'Six colours' },
  { frameworkClass: 'screen--color-7a', id: '7a', name: 'Seven colours' },
] as const

/** A Palette Family in words, or nothing for a family no custom Palette can be in. */
export function paletteFamilyName(frameworkClass: string): string | undefined {
  return PALETTE_FAMILIES.find(family => family.frameworkClass === frameworkClass)?.name
}
