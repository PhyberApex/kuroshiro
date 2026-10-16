/*
 * The words `l_word` translates, ported from TRMNL's trmnl-i18n gem (`locales/custom_plugins/<locale>.yml`).
 * MIT License, Copyright (c) 2025 TRMNL.
 */
const WORDS: Record<string, Record<string, string>> = {
  'cs': { today: 'dnes', tomorrow: 'zítra', updated: 'Aktualizováno', activity: 'Aktivita', done: 'Hotovo', due: 'Termín' },
  'da': { today: 'i dag', tomorrow: 'i morgen', updated: 'Opdateret', activity: 'Aktivitet', done: 'Udført', due: 'Forfald' },
  'de': { today: 'Heute', tomorrow: 'Morgen', updated: 'Aktualisiert', activity: 'Aktivität', done: 'Erledigt', due: 'Fällig' },
  'de-AT': { today: 'Heute', tomorrow: 'Morgen', updated: 'Aktualisiert', activity: 'Aktivität', done: 'Erledigt', due: 'Fällig' },
  'en': { today: 'today', tomorrow: 'tomorrow', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'es-ES': { today: 'hoy', tomorrow: 'mañana', updated: 'Actualizado', activity: 'Actividad', done: 'Completado', due: 'Vence' },
  'fr': { today: 'aujourd\'hui', tomorrow: 'demain', updated: 'Mis à jour', activity: 'Activité', done: 'Terminé', due: 'À faire' },
  'he': { today: 'היום', tomorrow: 'מחר', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'hu': { today: 'today', tomorrow: 'tomorrow', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'id': { today: 'today', tomorrow: 'tomorrow', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'is': { today: 'í dag', tomorrow: 'á morgun', updated: 'Uppfært', activity: 'Virkni', done: 'Lokið', due: 'Eftir' },
  'it': { today: 'Oggi', tomorrow: 'Domani', updated: 'Aggiornato', activity: 'Attività', done: 'Finito', due: 'Scadenza' },
  'ja': { today: '今日', tomorrow: '明日', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'ko': { today: '오늘', tomorrow: '내일', updated: '업데이트됨', activity: '활동', done: '완료', due: '마감' },
  'lt': { today: 'šiandien', tomorrow: 'rytoj', updated: 'Atnaujinta', activity: 'Veikla', done: 'Atlikta', due: 'Terminas' },
  'nl': { today: 'vandaag', tomorrow: 'morgen', updated: 'Bijgewerkt', activity: 'Activiteit', done: 'Gedaan', due: 'Verschuldigd' },
  'pl': { today: 'dziś', tomorrow: 'jutro', updated: 'Zaktualizowano', activity: 'Aktywność', done: 'Zrobione', due: 'Do zrobienia' },
  'pt-BR': { today: 'hoje', tomorrow: 'amanhã', updated: 'Atualizado', activity: 'Atividade', done: 'Done', due: 'Até' },
  'raw': { today: 'today', tomorrow: 'tomorrow', updated: 'custom_plugins.updated', activity: 'custom_plugins.activity', done: 'custom_plugins.done', due: 'custom_plugins.due' },
  'ro': { today: 'astăzi', tomorrow: 'mâine', updated: 'Actualizat', activity: 'Activitate', done: 'Terminat', due: 'Termen' },
  'ru': { today: 'сегодня', tomorrow: 'завтра', updated: 'Обновлено', activity: 'Активность', done: 'Готово', due: 'Срок' },
  'sk': { today: 'today', tomorrow: 'tomorrow', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'sl': { today: 'danes', tomorrow: 'jutri', updated: 'Posodobljeno', activity: 'Dejavnost', done: 'Končano', due: 'Zapadlo' },
  'sv': { today: 'today', tomorrow: 'tomorrow', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'uk': { today: 'today', tomorrow: 'tomorrow', updated: 'Updated', activity: 'Activity', done: 'Done', due: 'Due' },
  'zh-CN': { today: '今天', tomorrow: '明天', updated: '已更新', activity: '活动', done: '完成', due: '到期' },
  'zh-HK': { today: '今日', tomorrow: '明日', updated: '更新', activity: '活動', done: '完成', due: '限期' },
}

/** TRMNL's `l_word`: the word in the locale, by the whole tag and then its language; an unknown word or locale is the input unchanged. */
export function localizeWord(value: unknown, locale: unknown = 'en'): unknown {
  const word = String(value)
  const tag = String(locale)
  const table = WORDS[tag] ?? WORDS[tag.split('-')[0]]
  return table?.[word] ?? value
}
