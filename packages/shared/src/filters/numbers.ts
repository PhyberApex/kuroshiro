const LOCALE = /^[a-z]{2,3}(?:-[A-Z0-9]{2,8})*$/i

/** Currency Intl cannot derive from a locale: the one the locale's region (or, lacking one, its language) uses. */
const CURRENCY_OF: Record<string, string> = {
  AU: 'AUD',
  BR: 'BRL',
  CA: 'CAD',
  CH: 'CHF',
  CN: 'CNY',
  CZ: 'CZK',
  DK: 'DKK',
  GB: 'GBP',
  IN: 'INR',
  JP: 'JPY',
  KR: 'KRW',
  MX: 'MXN',
  NO: 'NOK',
  PL: 'PLN',
  SE: 'SEK',
  US: 'USD',
  cs: 'CZK',
  da: 'DKK',
  ja: 'JPY',
  ko: 'KRW',
  nb: 'NOK',
  no: 'NOK',
  pl: 'PLN',
  sv: 'SEK',
  zh: 'CNY',
}
const EURO_REGIONS = new Set(['AT', 'BE', 'DE', 'ES', 'FI', 'FR', 'GR', 'IE', 'IT', 'NL', 'PT'])
const EURO_LANGUAGES = new Set(['de', 'es', 'fi', 'fr', 'it', 'nl', 'pt', 'el'])

function currencyOf(locale: string): string {
  const [language, region] = locale.split('-')
  const upper = region?.toUpperCase()
  if (upper && CURRENCY_OF[upper])
    return CURRENCY_OF[upper]
  if (upper && EURO_REGIONS.has(upper))
    return 'EUR'
  const lower = language.toLowerCase()
  if (CURRENCY_OF[lower])
    return CURRENCY_OF[lower]
  return EURO_LANGUAGES.has(lower) ? 'EUR' : 'USD'
}

/** `'CHF'` and `'kr'` read like language tags; only a locale the runtime knows is taken for one. */
function supportsLocale(tag: string): boolean {
  try {
    return Intl.NumberFormat.supportedLocalesOf(tag).length > 0
  }
  catch {
    return false
  }
}

function group(digits: string, delimiter: string): string {
  return delimiter === '' ? digits : digits.replace(/\B(?=(\d{3})+$)/g, delimiter)
}

/** Rails' `number_with_delimiter`: the digits keep the fraction they came with. */
export function numberWithDelimiter(value: unknown, delimiter: unknown = ',', separator: unknown = '.'): string {
  const text = String(value).trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(text))
    return String(value)
  const negative = text.startsWith('-')
  const [whole, fraction] = text.replace('-', '').split('.')
  const grouped = group(whole, String(delimiter))
  return `${negative ? '-' : ''}${grouped}${fraction === undefined ? '' : `${separator}${fraction}`}`
}

/**
 * TRMNL's `number_to_currency`. A unit (`'£'`) goes in front with `,` and `.`; a locale (`'sv'`) puts its own unit where
 * its own format does, and groups nothing unless a delimiter says to, as the doc's `1234.57 kr` shows.
 */
export function numberToCurrency(value: unknown, unitOrLocale: unknown = '$', delimiter?: unknown, separator?: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount))
    return String(value)
  const sign = amount < 0 ? '-' : ''
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.')
  const argument = String(unitOrLocale)
  const isLocale = argument.length > 1 && LOCALE.test(argument) && supportsLocale(argument)
  const digits = (defaultDelimiter: string) =>
    `${group(whole, delimiter === undefined ? defaultDelimiter : String(delimiter))}${separator === undefined ? '.' : String(separator)}${fraction}`
  if (!isLocale)
    return `${sign}${argument}${digits(',')}`
  try {
    const parts = new Intl.NumberFormat(argument, { style: 'currency', currency: currencyOf(argument) }).formatToParts(1)
    const unit = parts.find(part => part.type === 'currency')?.value ?? ''
    const unitFirst = parts.findIndex(part => part.type === 'currency') < parts.findIndex(part => part.type === 'integer')
    return unitFirst ? `${sign}${unit}${digits('')}` : `${sign}${digits('')} ${unit}`
  }
  catch {
    return `${sign}${argument}${digits(',')}`
  }
}
