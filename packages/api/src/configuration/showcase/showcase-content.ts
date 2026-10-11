// The showcase Configuration Archive's Plugins, authored from scratch (ADR-0042): each reads only a
// public API or a literal value, so importing this archive never requires a secret or a private address.

export interface ShowcaseDataSource {
  id: string
  name: string
  mode?: 'literal'
  endpoint?: string
  method?: string
  headers?: Record<string, string>
  literalValue?: Record<string, unknown>
}

export interface ShowcasePlugin {
  id: string
  name: string
  description: string
  refreshInterval: number
  /** Set on the Dad Joke Plugin to show a Recipe-imported Plugin in the showcase; not a real trmnl.com Recipe id. */
  sourceRecipeId: string | null
  dataSources: ShowcaseDataSource[]
  templateId: string
  liquidMarkup: string
}

export const WEATHER_PLUGIN: ShowcasePlugin = {
  id: '700e9153-35b5-4806-9ce0-2b8d3f03f135',
  name: 'Open-Meteo Weather',
  description: 'Current temperature for Berlin from Open-Meteo\'s public forecast API — no API key required.',
  refreshInterval: 30,
  sourceRecipeId: null,
  dataSources: [
    {
      id: 'a7ed35f2-a0e3-4c3c-b930-0e066699f49f',
      name: 'forecast',
      endpoint: 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.405&current=temperature_2m,weather_code&timezone=auto',
      method: 'GET',
    },
  ],
  templateId: 'dff8ecfc-2cf5-4c17-8927-7931a2c25a79',
  liquidMarkup: `<div class="layout layout--col layout--center gap--large">
  <span class="value value--xxxlarge value--tnums">{{ forecast.current.temperature_2m }}°</span>
  <span class="label">Current temperature</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">Berlin · Open-Meteo</span>
</div>
`,
}

export const COUNTDOWN_PLUGIN: ShowcasePlugin = {
  id: '28d4ed58-d387-432b-9624-939a078c710f',
  name: 'Countdown',
  description: 'Days remaining until a fixed date, computed in the template from a literal Data Source — no network request.',
  refreshInterval: 60,
  sourceRecipeId: null,
  dataSources: [
    {
      id: '055ad61a-de68-40e0-8e9f-d2f2fd0a29bb',
      name: 'countdown',
      mode: 'literal',
      literalValue: { label: '2030', targetDate: '2030-01-01' },
    },
  ],
  templateId: 'e902cc9e-ea61-42e8-9d45-4ce9bc80d361',
  liquidMarkup: `<div class="layout layout--col layout--center gap--large">
  {% assign target_seconds = countdown.targetDate | date: '%s' %}
  {% assign now_seconds = 'now' | date: '%s' %}
  {% assign days_left = target_seconds | minus: now_seconds | divided_by: 86400 %}
  <span class="value value--xxxlarge value--tnums">{{ days_left }}</span>
  <span class="label">days until {{ countdown.label }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">Countdown</span>
</div>
`,
}

export const JOKE_PLUGIN: ShowcasePlugin = {
  id: '195cf50a-f8aa-42f2-8282-a9a0be2b4169',
  name: 'Dad Joke',
  description: 'A random joke from icanhazdadjoke.com\'s public API, standing in for a Plugin imported from a Recipe.',
  refreshInterval: 60,
  sourceRecipeId: 'kuroshiro-showcase-dad-joke',
  dataSources: [
    {
      id: 'a1be24ee-c914-436b-9444-895c1d4c029f',
      name: 'joke',
      endpoint: 'https://icanhazdadjoke.com/',
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  ],
  templateId: '618fbb56-8c5b-423b-80ca-a3707e2a4f9e',
  liquidMarkup: `<div class="layout layout--col layout--center gap--large">
  <span class="value value--large text--center">{{ joke.joke }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">Dad Joke</span>
</div>
`,
}

export const SHOWCASE_PLUGINS: ShowcasePlugin[] = [WEATHER_PLUGIN, COUNTDOWN_PLUGIN, JOKE_PLUGIN]
