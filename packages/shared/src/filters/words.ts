/** The words `l_word` knows, for the locales `Intl` has no word for (it names months and weekdays, not "today"). */
const WORDS: Record<string, Record<string, string>> = {
  en: { today: 'today', tomorrow: 'tomorrow', yesterday: 'yesterday' },
  de: { today: 'heute', tomorrow: 'morgen', yesterday: 'gestern' },
  es: { today: 'hoy', tomorrow: 'mañana', yesterday: 'ayer' },
  fr: { today: 'aujourd\'hui', tomorrow: 'demain', yesterday: 'hier' },
  ko: { today: '오늘', tomorrow: '내일', yesterday: '어제' },
  ja: { today: '今日', tomorrow: '明日', yesterday: '昨日' },
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function calendarName(locale: string, word: string): string | undefined {
  const weekday = WEEKDAYS.indexOf(word)
  const month = MONTHS.indexOf(word)
  if (weekday < 0 && month < 0)
    return undefined
  try {
    const date = new Date(weekday >= 0 ? Date.UTC(2021, 0, 3 + weekday) : Date.UTC(2021, month, 15))
    return date.toLocaleDateString(locale, weekday >= 0 ? { weekday: 'long', timeZone: 'UTC' } : { month: 'long', timeZone: 'UTC' })
  }
  catch {
    return undefined
  }
}

export function localizeWord(value: unknown, locale: unknown = 'en'): unknown {
  const word = String(value).trim().toLowerCase()
  const language = String(locale).split('-')[0].toLowerCase()
  return WORDS[language]?.[word] ?? calendarName(String(locale), word) ?? value
}
