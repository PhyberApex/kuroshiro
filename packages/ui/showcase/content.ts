import type { TemplateSize } from 'kuroshiro-shared'

type Templates = Partial<Record<TemplateSize, string>>

function titleBar(title: string, instance: string) {
  return `<div class="title_bar">
  <span class="title">${title}</span>
  <span class="instance">${instance}</span>
</div>`
}

export const MORNING_BRIEFING_HTML = `<div class="layout layout--row gap--xlarge">
  <div class="flex flex--col gap--small">
    <span class="label">Tuesday</span>
    <span class="value value--xxxlarge value--tnums">6</span>
    <span class="title">October</span>
  </div>
  <div class="columns">
    <div class="column">
      <span class="label label--underline">Today</span>
      <div class="item">
        <div class="meta"></div>
        <div class="content">
          <span class="title title--small">School run</span>
          <span class="description">07:45 · Lena &amp; Max</span>
        </div>
      </div>
      <div class="item">
        <div class="meta"></div>
        <div class="content">
          <span class="title title--small">Dentist</span>
          <span class="description">10:30 · Dr. Okafor</span>
        </div>
      </div>
      <div class="item">
        <div class="meta"></div>
        <div class="content">
          <span class="title title--small">Climbing</span>
          <span class="description">18:00 · Nordwand Hall</span>
        </div>
      </div>
    </div>
    <div class="column">
      <span class="label label--underline">Outside</span>
      <div class="item">
        <div class="content">
          <span class="value value--tnums">14°</span>
          <span class="description">Light rain from 15:00</span>
        </div>
      </div>
      <div class="item">
        <div class="content">
          <span class="value value--tnums">06:52</span>
          <span class="description">Sunrise · sunset 18:41</span>
        </div>
      </div>
    </div>
  </div>
</div>
${titleBar('Morning briefing', 'Kitchen')}`

export const BEDTIME_HTML = `<div class="layout layout--col layout--center gap--large">
  <span class="value value--xxlarge">Sleep well</span>
  <span class="description">Alarm 06:30 · Tomorrow 12° and sunny</span>
</div>
${titleBar('Good night', 'Bedroom')}`

export const OFFICE_HTML = `<div class="layout layout--row gap--xlarge">
  <div class="flex flex--col gap--small">
    <span class="label">Focus until</span>
    <span class="value value--xxlarge value--tnums">11:30</span>
    <span class="description">Do not disturb</span>
  </div>
  <div class="column">
    <span class="label label--underline">Meetings</span>
    <div class="item">
      <div class="meta"></div>
      <div class="content">
        <span class="title title--small">11:30 · Design review</span>
        <span class="description">Room Elbe · 45 min</span>
      </div>
    </div>
    <div class="item">
      <div class="meta"></div>
      <div class="content">
        <span class="title title--small">14:00 · Release planning</span>
        <span class="description">Video call · 30 min</span>
      </div>
    </div>
  </div>
</div>
${titleBar('Office hours', 'Office')}`

export const HALLWAY_HTML = `<div class="layout layout--col layout--center gap--large">
  <span class="value value--xlarge">Take an umbrella</span>
  <span class="description">Rain from 15:00 · next M5 in 3 min · paper bin out tonight</span>
</div>
${titleBar('Before you leave', 'Hallway')}`

export const WEATHER_FORECAST = {
  location: 'Hamburg',
  now: { temperature: 14, feels_like: 12, summary: 'Light rain from 15:00', wind: 18, humidity: 81 },
  hourly: [
    { time: '09:00', temperature: 12, rain: 10 },
    { time: '12:00', temperature: 14, rain: 20 },
    { time: '15:00', temperature: 14, rain: 70 },
    { time: '18:00', temperature: 12, rain: 60 },
    { time: '21:00', temperature: 10, rain: 30 },
  ],
}

export const AIR_QUALITY = { index: 2, label: 'Good', pollen: 'Low' }

export const WEATHER_TEMPLATES: Templates = {
  full: `<div class="layout layout--row gap--xlarge">
  <div class="flex flex--col gap--small">
    <span class="value value--xxxlarge value--tnums">{{ forecast.now.temperature }}°</span>
    <span class="title">{{ forecast.now.summary }}</span>
    <span class="description">Feels like {{ forecast.now.feels_like }}° · wind {{ forecast.now.wind }} km/h</span>
    <span class="description">Air quality {{ air.label | downcase }} · pollen {{ air.pollen | downcase }}</span>
  </div>
  <div class="columns">
    {% for hour in forecast.hourly %}
      <div class="column text--center">
        <span class="label">{{ hour.time }}</span>
        <span class="value value--small value--tnums">{{ hour.temperature }}°</span>
        <span class="description">{{ hour.rain }}% rain</span>
      </div>
    {% endfor %}
  </div>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ forecast.location }}</span>
</div>`,
  half_vertical: `<div class="layout layout--col gap--large">
  <span class="value value--xxlarge value--tnums">{{ forecast.now.temperature }}°</span>
  <span class="title">{{ forecast.now.summary }}</span>
  {% for hour in forecast.hourly limit: 4 %}
    <div class="item">
      <div class="content">
        <span class="title title--small">{{ hour.time }} · {{ hour.temperature }}°</span>
        <span class="description">{{ hour.rain }}% rain</span>
      </div>
    </div>
  {% endfor %}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ forecast.location }}</span>
</div>`,
  half_horizontal: `<div class="layout layout--row gap--large">
  <span class="value value--xlarge value--tnums">{{ forecast.now.temperature }}°</span>
  <span class="title">{{ forecast.now.summary }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`,
  quadrant: `<div class="layout layout--col layout--center">
  <span class="value value--xlarge value--tnums">{{ forecast.now.temperature }}°</span>
  <span class="description">{{ forecast.now.summary }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`,
}

export const DEPARTURES = {
  stop: 'Lindenplatz',
  departures: [
    { line: 'M5', towards: 'Hauptbahnhof', minutes: 3 },
    { line: '12', towards: 'Ostpark', minutes: 7 },
    { line: 'M5', towards: 'Hauptbahnhof', minutes: 13 },
    { line: '4', towards: 'Messe Süd', minutes: 18 },
  ],
}

function departureRows(limit: number) {
  return `{% for departure in transit.departures limit: ${limit} %}
    <div class="item">
      <div class="meta"></div>
      <div class="content">
        <span class="title title--small">{{ departure.line }} → {{ departure.towards }}</span>
        <span class="description">in {{ departure.minutes }} min</span>
      </div>
    </div>
  {% endfor %}`
}

export const DEPARTURES_TEMPLATES: Templates = {
  full: `<div class="layout layout--col gap--medium">
  ${departureRows(4)}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ transit.stop }}</span>
</div>`,
  quadrant: `<div class="layout layout--col gap--small">
  ${departureRows(2)}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`,
  half_vertical: `<div class="layout layout--col gap--medium">
  ${departureRows(4)}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`,
}

export const QUOTE = {
  text: 'The best way to predict the future is to invent it.',
  author: 'Alan Kay',
}

export const QUOTE_TEMPLATES: Templates = {
  full: `<div class="layout layout--col layout--center gap--large">
  <span class="value value--large text--center">“{{ quote.text }}”</span>
  <span class="label">{{ quote.author }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`,
  quadrant: `<div class="layout layout--col layout--center gap--small">
  <span class="title text--center">“{{ quote.text }}”</span>
  <span class="label">{{ quote.author }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`,
}

export const WASTE_TEMPLATES: Templates = {
  full: `<div class="layout layout--col gap--medium">
  {% for collection in bins.collections %}
    <div class="item">
      <div class="content">
        <span class="title title--small">{{ collection.kind }}</span>
        <span class="description">{{ collection.date }}</span>
      </div>
    </div>
  {% endfor %}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`,
}

export const CALENDAR_PAYLOAD = {
  day: 'Tuesday, 6 October',
  events: [
    { time: '07:45', title: 'School run', who: 'Lena & Max' },
    { time: '10:30', title: 'Dentist', who: 'Mira' },
    { time: '16:00', title: 'Piano lesson', who: 'Lena' },
    { time: '18:00', title: 'Climbing', who: 'Jonas' },
  ],
}

export const CALENDAR_TEMPLATES: Templates = {
  full: `<div class="layout layout--col gap--medium">
  <span class="label label--underline">{{ day }}</span>
  {% for event in events %}
    <div class="item">
      <div class="meta"></div>
      <div class="content">
        <span class="title title--small">{{ event.time }} · {{ event.title }}</span>
        <span class="description">{{ event.who }}</span>
      </div>
    </div>
  {% endfor %}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ events.size }} today</span>
</div>`,
}

export const ENERGY_PAYLOAD = {
  solar_kwh: 11.4,
  grid_kwh: 3.2,
  battery_percent: 76,
}

export const ENERGY_TEMPLATES: Templates = {
  full: `<div class="layout layout--row gap--xlarge layout--center">
  <div class="flex flex--col"><span class="value value--xlarge value--tnums">{{ solar_kwh }}</span><span class="label">kWh solar today</span></div>
  <div class="flex flex--col"><span class="value value--xlarge value--tnums">{{ grid_kwh }}</span><span class="label">kWh from the grid</span></div>
  <div class="flex flex--col"><span class="value value--xlarge value--tnums">{{ battery_percent }}%</span><span class="label">home battery</span></div>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">Home Assistant</span>
</div>`,
}

/** A landscape drawn in grey tones, the kind of picture a Device dithers well, standing in for an uploaded photo. */
export const FJORD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2b2b"/><stop offset="0.55" stop-color="#9a9a9a"/><stop offset="1" stop-color="#e8e8e8"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d0d0d0"/><stop offset="1" stop-color="#3a3a3a"/>
    </linearGradient>
  </defs>
  <rect width="800" height="480" fill="url(#sky)"/>
  <circle cx="560" cy="250" r="46" fill="#f6f6f6"/>
  <path d="M0 300 L120 170 L210 250 L330 120 L450 260 L520 210 L640 290 L800 180 L800 320 L0 320 Z" fill="#555"/>
  <path d="M0 320 L90 250 L190 300 L290 230 L420 310 L560 260 L690 320 L800 280 L800 330 L0 330 Z" fill="#2a2a2a"/>
  <rect y="328" width="800" height="152" fill="url(#water)"/>
  <g stroke="#f0f0f0" stroke-width="3" stroke-linecap="round" opacity="0.8">
    <line x1="520" y1="350" x2="600" y2="350"/><line x1="500" y1="372" x2="620" y2="372"/><line x1="530" y1="396" x2="590" y2="396"/>
  </g>
  <path d="M150 410 l40 0 l-6 12 l-30 0 Z M172 410 l0 -34 l16 30 Z" fill="#111"/>
</svg>`

/** A week of tides as a curve, standing in for the chart a tide service publishes as an image. */
export function tideChartSvg() {
  const points = Array.from({ length: 81 }, (_, step) => {
    const x = 40 + step * 9
    const y = 240 - Math.sin(step / 6.4) * 120
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const days = ['Tue', 'Wed', 'Thu', 'Fri']
    .map((day, index) => `<text x="${60 + index * 180}" y="440" font-size="26" font-family="sans-serif" fill="#000">${day}</text>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
  <rect width="800" height="480" fill="#fff"/>
  <text x="40" y="58" font-size="36" font-weight="700" font-family="sans-serif" fill="#000">Tides · Elbe at St. Pauli</text>
  <text x="40" y="94" font-size="24" font-family="sans-serif" fill="#333">High water 14:32 · 3.9 m   Low water 21:08 · 0.4 m</text>
  <line x1="40" y1="240" x2="770" y2="240" stroke="#999" stroke-width="2" stroke-dasharray="8 8"/>
  <polyline points="${points}" fill="none" stroke="#000" stroke-width="6"/>
  <line x1="40" y1="400" x2="770" y2="400" stroke="#000" stroke-width="2"/>
  ${days}
</svg>`
}
