/** Ruby's `to_i`: the leading integer of the text, `0` when there is none; a number is truncated. */
export function toInteger(value: unknown): number {
  if (typeof value === 'number')
    return Number.isFinite(value) ? Math.trunc(value) : 0
  const match = /^\s*([-+]?\d+)/.exec(String(value ?? ''))
  return match ? Number(match[1]) : 0
}

function group(digits: string, delimiter: string): string {
  return delimiter === '' ? digits : digits.replace(/\B(?=(\d{3})+$)/g, delimiter)
}

/** TRMNL's `number_with_delimiter`: the digits keep the fraction they came with; anything but a plain number is returned as it is. */
export function numberWithDelimiter(value: unknown, delimiter: unknown = ',', separator: unknown = '.'): string {
  const text = String(value)
  if (!/^-?\d+(?:\.\d+)?$/.test(text))
    return text
  const negative = text.startsWith('-')
  const [whole, fraction] = text.replace('-', '').split('.')
  const grouped = group(whole, String(delimiter))
  return `${negative ? '-' : ''}${grouped}${fraction === undefined ? '' : `${separator}${fraction}`}`
}

/*
 * The currency unit and its place for the locales `trmnl.user.locale` can hold: the 27 of TRMNL's trmnl-i18n gem
 * (MIT, Copyright (c) 2025 TRMNL) with symbol and position from rails-i18n's `number.currency.format`
 * (MIT, Copyright (c) 2008 Sven Fuchs), plus `en-GB`, the one ADR-0043's example uses. `%u` is the unit, `%n` the number.
 */
const CURRENCY_FORMATS: Record<string, { unit: string, format: string }> = {
  'cs': { unit: 'Kč', format: '%n %u' },
  'da': { unit: 'DKK', format: '%u %n' },
  'de': { unit: '€', format: '%n %u' },
  'de-AT': { unit: '€', format: '%u %n' },
  'en': { unit: '$', format: '%u%n' },
  'en-GB': { unit: '£', format: '%u%n' },
  'es-ES': { unit: '€', format: '%n %u' },
  'fr': { unit: '€', format: '%n %u' },
  'he': { unit: '₪', format: '%n %u' },
  'hu': { unit: 'Ft', format: '%n %u' },
  'id': { unit: 'Rp', format: '%u%n' },
  'is': { unit: 'kr.', format: '%n %u' },
  'it': { unit: '€', format: '%n %u' },
  'ja': { unit: '円', format: '%n%u' },
  'ko': { unit: '원', format: '%n%u' },
  'lt': { unit: '€', format: '%n %u' },
  'nl': { unit: '€', format: '%u %n' },
  'pl': { unit: 'zł', format: '%n %u' },
  'pt-BR': { unit: 'R$', format: '%u %n' },
  'raw': { unit: '$', format: '%u%n' },
  'ro': { unit: 'RON', format: '%n %u' },
  'ru': { unit: 'руб.', format: '%n %u' },
  'sk': { unit: '€', format: '%n %u' },
  'sl': { unit: '€', format: '%u%n' },
  'sv': { unit: 'kr', format: '%n %u' },
  'uk': { unit: '₴', format: '%n %u' },
  'zh-CN': { unit: 'CN¥', format: '%u %n' },
  'zh-HK': { unit: 'HK$', format: '%u %n' },
}

/**
 * TRMNL's `number_to_currency(number, unit_or_locale = '$', delimiter = ',', separator = '.', precision = 2)`. The first
 * argument is a locale when trmnl-i18n ships it, placing that locale's unit where its format puts it, and a unit
 * prefix otherwise. Thousands are grouped with the delimiter either way, as the gem passes it explicitly.
 */
export function numberToCurrency(value: unknown, unitOrLocale: unknown = '$', delimiter: unknown = ',', separator: unknown = '.', precision: unknown = 2): string {
  const amount = Number(value)
  if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(amount))
    return String(value ?? '')
  const places = Math.max(0, toInteger(precision))
  const [whole, fraction] = Math.abs(amount).toFixed(places).split('.')
  const digits = `${group(whole, String(delimiter))}${fraction === undefined ? '' : `${separator}${fraction}`}`
  const sign = amount < 0 ? '-' : ''
  const argument = String(unitOrLocale)
  const locale = CURRENCY_FORMATS[argument]
  if (!locale)
    return `${sign}${argument}${digits}`
  return `${sign}${locale.format.replace('%u', locale.unit).replace('%n', digits)}`
}
