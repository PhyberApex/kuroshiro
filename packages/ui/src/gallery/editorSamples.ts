import { screenArt } from './screenArt'

/** What the code editor, the preview plate and the bench show in the gallery. */
export const WEATHER_TEMPLATE = `<div class="grid grid--cols-7">
  {% for hour in forecast.hourly limit: 7 %}
    <span class="label">{{ hour.time }}:00 · {{ hour.rain }}%</span>
  {% endfor %}
</div>
{% comment %} The title bar names the place {% endcomment %}
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ location | titleize }}</span>
</div>`

export const UNCLOSED_TEMPLATE = WEATHER_TEMPLATE.replace('  {% endfor %}\n', '')

export const UNCLOSED_PROBLEM = { line: 2, message: 'tag {% for hour in forecast.hourly limit: 7 %} not closed' }

export const WEATHER_DATA = {
  location: 'Lindenplatz',
  show_wind: true,
  forecast: {
    current: { temperature: 14.3, feels_like: 12.1, summary: 'Rain from 15:00', wind: 18 },
    hourly: [12, 13, 14, 15, 16, 17, 18, 19].map(time => ({ time, temperature: 14, rain: 35 })),
  },
  trmnl: { plugin_settings: { instance_name: 'Weather' } },
}

export const KUROSHIRO_FILTER_NAMES = ['date_short', 'date_long', 'time_short', 'number_with_delimiter', 'round', 'truncate_words', 'titleize', 'shuffle', 'sample', 'yesno', 'json', 'url_encode', 'url_decode']

export const FRIDGE_NOTE_HTML = `<div class="layout layout--col layout--center">
  <span class="value value--xlarge">Bins go out tonight</span>
  <span class="description">Paper and glass. {{ shown as written }}</span>
</div>
<div class="title_bar">
  <span class="title">Fridge note</span>
</div>`

export const HEADERS_JSON = `{
  "Accept": "application/json"
}`

export const BROKEN_HEADERS_JSON = `{
  "Accept": "application/json",
}`

export const TRANSFORM_JAVASCRIPT = `function transform(input) {
  const hours = input.hourly.slice(0, 8)
  return { current: input.current, hourly: hours, updated: input.updated }
}`

/** A complete document that fills the frame with the stand-in Screen, drawn as rectangles so it looks the same on every machine. */
export function screenDocument(width: number, height: number) {
  return `<!doctype html><html><body style="margin:0"><img alt="" src="${screenArt(width, height)}" style="display:block;width:100vw;height:100vh"></body></html>`
}
