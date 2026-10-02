// PROTOTYPE, throwaway. Wayfinder ticket "The Plugin template editor" (#1095). All data is synthetic and nothing is saved.
// The editor is CodeMirror 6 and the preview is rendered by liquidjs in the browser; both come from vendor/editor.bundle.js.
/* global KuroEditor, sprite */
const K = KuroEditor
document.querySelector('#sprite').innerHTML = sprite

/* ── what the server would hand over ── */

const PALETTES = {
  'bw': { name: 'Black & White (1-bit)', short: 'black and white', cls: 'screen--1bit' },
  'gray-4': { name: '4 Grays (2-bit)', short: '4 grays', cls: 'screen--2bit' },
  'gray-16': { name: '16 Grays (4-bit)', short: '16 grays', cls: 'screen--4bit' },
  'color-6a': { name: 'Color (6 colors)', short: '6 colours', cls: 'screen--color-6a' },
}
const vars = (w, h, ratio, dither) => ({ '--screen-w': `${w}px`, '--screen-h': `${h}px`, '--pixel-ratio': ratio, '--dither-pixel-ratio': dither, '--device-ui-scale': '1.0', '--gap-scale': '1.0' })
const MODELS = {
  og_plus: { label: 'TRMNL OG (2-bit)', w: 800, h: 480, classes: ['screen--ogv2', 'screen--md', 'screen--density-1x'], vars: vars(800, 480, '1.0', '1.0'), palettes: ['gray-4', 'bw'] },
  og_png: { label: 'TRMNL OG (1-bit)', w: 800, h: 480, classes: ['screen--og_png', 'screen--md', 'screen--density-1x'], vars: vars(800, 480, '1.0', '1.0'), palettes: ['bw'] },
  v2: { label: 'TRMNL X', w: 1872, h: 1404, classes: ['screen--v2', 'screen--lg', 'screen--density-2x'], vars: vars(1040, 780, '1.8', '2.0'), palettes: ['gray-16', 'gray-4', 'bw'] },
  inkplate_10: { label: 'Inkplate 10', w: 1200, h: 825, classes: ['screen--inkplate_10', 'screen--md', 'screen--density-2x'], vars: vars(800, 550, '1.5', '2.0'), palettes: ['gray-4', 'bw'] },
  seeed_e1002: { label: 'Seeed E1002', w: 800, h: 480, classes: ['screen--ogv2', 'screen--md', 'screen--density-1x'], vars: vars(800, 480, '1.0', '1.0'), palettes: ['color-6a', 'bw'] },
}
const allDevices = [
  { id: 'kitchen', name: 'Kitchen', model: 'og_plus', palette: 'gray-4', sensors: { temperature: { value: 21.4, unit: 'celsius' }, humidity: { value: 48, unit: 'percent' } } },
  { id: 'hallway', name: 'Hallway', model: 'v2', palette: 'gray-16', sensors: {} },
  { id: 'study', name: 'Study', model: 'inkplate_10', palette: 'gray-4', sensors: {} },
]

const weatherFull = `<div class="layout layout--col gap--space-between">
  <div class="flex flex--row gap--xlarge">
    <div class="item">
      <div class="content">
        <span class="value value--xxxlarge">{{ forecast.current.temperature | round }}°</span>
        <span class="label">{{ forecast.current.summary }}</span>
      </div>
    </div>
    {% if show_wind %}
      <div class="item">
        <div class="content">
          <span class="value value--large">{{ forecast.current.wind }}</span>
          <span class="label">km/h wind</span>
        </div>
      </div>
    {% endif %}
  </div>
  <div class="grid grid--cols-7">
    {% for hour in forecast.hourly limit: 7 %}
      <div class="item">
        <div class="content">
          <span class="value value--small">{{ hour.temperature | round }}°</span>
          <span class="label">{{ hour.time }}:00 · {{ hour.rain }}%</span>
        </div>
      </div>
    {% endfor %}
  </div>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ location }}</span>
</div>`
const weatherQuadrant = `<div class="layout layout--col layout--center">
  <span class="value value--xxlarge">{{ forecast.current.temperature | round }}°</span>
  <span class="label">{{ forecast.current.summary }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`
const starter = `<div class="layout layout--col layout--center">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`
const noteTemplate = `<div class="layout layout--col layout--left">
  <span class="value value--xlarge">{{ title }}</span>
  <span class="description">{{ body }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ from }}</span>
</div>`
const forecast = {
  current: { temperature: 14.3, feels_like: 12.1, summary: 'Rain from 15:00', wind: 18 },
  hourly: [12, 13, 14, 15, 16, 17, 18, 19].map((time, i) => ({ time, temperature: [14.3, 14.8, 15.1, 13.9, 13.2, 12.6, 12.1, 11.4][i], rain: [5, 10, 35, 80, 90, 70, 40, 20][i] })),
  updated: '2026-10-02T11:40:00Z',
}
const transform = `function transform(input) {
  const hours = input.hourly.slice(0, 8)
  return { current: input.current, hourly: hours, updated: input.updated }
}`

const allPlugins = [
  { id: 'weather', name: 'Weather', kind: 'Poll', every: '15 minutes', recipe: 'Weather', on: ['kitchen', 'hallway'],
    fields: [
      { key: 'location', label: 'Location', type: 'text', required: true, help: 'A place name or a postcode.' },
      { key: 'units', label: 'Units', type: 'select', options: ['metric', 'imperial'], def: 'metric' },
      { key: 'show_wind', label: 'Show wind', type: 'switch' },
    ],
    saved: {
      templates: { full: weatherFull, quadrant: weatherQuadrant },
      sources: [{ name: 'forecast', method: 'GET', url: 'https://api.open-meteo.example/v1/forecast?q={{ location }}&units={{ units }}', headers: '{\n  "Accept": "application/json"\n}', transform }],
      values: { location: 'Lindenplatz', units: 'metric', show_wind: true },
    },
    data: { forecast } },
  { id: 'sourdough', name: 'Sourdough timer', kind: 'Poll', every: '15 minutes', on: [], fresh: true, fields: [],
    saved: { templates: { full: starter }, sources: [], values: {} }, data: {} },
  { id: 'doorbell', name: 'Doorbell note', kind: 'Webhook', received: 'yesterday at 18:03', on: ['hallway'], fields: [],
    saved: { templates: { full: noteTemplate }, sources: [], values: {} },
    payload: { title: 'Back at six.', body: 'Soup is in the fridge.', from: 'Mirela' } },
]
const htmlScreens = [{ id: 'note', device: 'kitchen', name: 'Fridge note', html: `<div class="layout layout--col layout--center">
  <span class="value value--xlarge">Bins go out tonight</span>
  <span class="description">Paper and glass. The lids must close.</span>
</div>
<div class="title_bar">
  <span class="title">Fridge note</span>
</div>` }]

const LAYOUTS = {
  full: { name: 'Full', hint: '', is: 'the Screen on its own, and any Mashup slot that has no template of its own size' },
  half_horizontal: { name: 'Half horizontal', hint: 'top or bottom', is: 'the top or bottom half of a Mashup', mashup: '1Tx1B', slots: 2 },
  half_vertical: { name: 'Half vertical', hint: 'left or right', is: 'the left or right half of a Mashup', mashup: '1Lx1R', slots: 2 },
  quadrant: { name: 'Quadrant', hint: 'a quarter', is: 'a quarter of a Mashup', mashup: '2x2', slots: 4 },
}
const FILTERS = ['date_short', 'date_long', 'time_short', 'number_with_delimiter', 'round', 'truncate_words', 'titleize', 'shuffle', 'sample', 'yesno', 'json', 'url_encode', 'url_decode']

/* ── state ── */

const params = new URLSearchParams(location.search)
const pick = (key, allowed, fallback) => allowed.includes(params.get(key)) ? params.get(key) : fallback
const state = {
  theme: pick('theme', ['light', 'dark'], matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  count: Number(pick('devices', ['0', '1', '3'], '3')),
  data: pick('data', ['ok', 'failed', 'fetching', 'down'], 'ok'),
  sched: pick('sched', ['0', '1'], '0') === '1',
  wide: params.get('wide') === '1',
}
let page = null

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const icon = id => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`
const seal = size => `<svg class="seal" width="${size}" height="${size}" aria-hidden="true"><use href="#seal"/></svg>`
const busy = '<i class="busy" aria-hidden="true"></i>'
const list = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
const devices = () => allDevices.slice(0, state.count)
const $ = selector => document.querySelector(selector)
const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/* ── Liquid, as the server configures it (the filters move to packages/shared) ── */

const engine = new K.Liquid()
engine.registerFilter('date_short', d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
engine.registerFilter('date_long', d => new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
engine.registerFilter('time_short', d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
engine.registerFilter('number_with_delimiter', n => Number(n).toLocaleString('en-US'))
engine.registerFilter('round', (n, precision = 0) => Number(n).toFixed(precision))
engine.registerFilter('titleize', text => String(text).split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
engine.registerFilter('yesno', (value, yes = 'Yes', no = 'No') => value ? yes : no)
engine.registerFilter('json', value => JSON.stringify(value))
engine.registerFilter('url_encode', value => encodeURIComponent(String(value)))

function problemOf(error, source) {
  const [line, col] = error.token?.getPosition?.() ?? [1, 1]
  const from = error.token?.begin ?? 0
  const to = Math.min(source.length, Math.max(from + 1, error.token?.end ?? from + 1))
  return { line, col, from, to, message: error.message.replace(/, line:\d+, col:\d+$/, ''), parse: error.name !== 'RenderError' }
}

/* ── the screen shell, as packages/shared/src/screen-shell.ts writes it ── */

function shellDoc({ model, palette }, bodyHtml, layout = 'full') {
  const classes = ['screen', ...MODELS[model].classes, PALETTES[palette].cls].join(' ')
  const style = Object.entries(MODELS[model].vars).map(([name, value]) => `${name}: ${value};`).join(' ')
  const l = LAYOUTS[layout]
  const body = layout === 'full'
    ? `<div class="view view--full">${bodyHtml}</div>`
    : `<div class="mashup mashup--${l.mashup}"><div class="view view--${layout}">${bodyHtml}</div>${`<div class="view view--${layout}"></div>`.repeat(l.slots - 1)}</div>`
  return `<html>
  <head>
    <link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
    <script src="https://usetrmnl.com/js/latest/plugins.js"><\/script>
  </head>
  <body class="environment trmnl">
    <div class="${classes}" style="${style}">${body}</div>
  </body>
</html>`
}

/* ── the code editor ── */

const t = K.tags
const soft = 'var(--color-ink-soft)'
const hankoHighlight = K.HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.brace, t.processingInstruction], fontWeight: '700' },
  { tag: [t.tagName, t.propertyName, t.definition(t.variableName), t.function(t.variableName)], fontWeight: '600' },
  { tag: [t.angleBracket, t.string, t.attributeValue, t.punctuation, t.separator], color: soft },
  { tag: [t.comment, t.blockComment, t.lineComment], color: soft, fontStyle: 'italic' },
  { tag: [t.bool, t.null, t.atom], fontWeight: '600' },
])
const problemMask = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2 2h12v12H2zM7.2 4.5v4.6h1.6V4.5zM7.2 10.2v1.6h1.6v-1.6z"/></svg>') center / contain no-repeat`
const hankoTheme = K.EditorView.theme({
  '&': { color: 'var(--color-ink)', backgroundColor: 'var(--color-paper)', fontSize: 'var(--code-size, var(--text-xs))', height: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', scrollbarWidth: 'thin', scrollbarColor: 'var(--color-line) transparent' },
  '.cm-content': { padding: 'var(--space-3) 0', caretColor: 'var(--color-ink)' },
  '.cm-line': { padding: '0 var(--space-3)' },
  '.cm-gutters': { backgroundColor: 'var(--color-paper)', color: soft, border: 'none', borderRight: 'var(--rule)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 var(--space-2) 0 var(--space-2)', minWidth: '1.75rem', fontSize: '0.6875rem', lineHeight: 'inherit' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-ink)', fontWeight: '700' },
  '.cm-cursor': { borderLeft: '2px solid var(--color-ink)' },
  '.cm-liquid': { backgroundColor: 'var(--color-wash)', borderRadius: '1px', padding: '1px 0' },
  '.cm-matchingBracket': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'transparent', outline: '1px solid var(--color-ink)' },
  '.cm-nonmatchingBracket': { backgroundColor: 'transparent' },
  '.cm-gutter-lint': { width: '1.125rem' },
  '.cm-gutter-lint .cm-gutterElement': { padding: '0 0 0 var(--space-1)', display: 'flex', alignItems: 'center' },
  '.cm-lint-marker': { width: '0.875rem', height: '0.875rem' },
  '.cm-lint-marker-error': { content: 'normal', background: 'var(--color-ink)', mask: problemMask, WebkitMask: problemMask },
  '.cm-lintPoint-error:after': { borderBottomColor: 'var(--color-ink)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline double var(--color-ink)', textUnderlineOffset: '3px' },
  '.cm-tooltip': { border: '1px solid var(--color-ink)', borderRadius: 'var(--radius)', backgroundColor: 'var(--color-paper)', color: 'var(--color-ink)', fontSize: 'var(--text-xs)' },
  '.cm-tooltip-lint': { fontFamily: 'var(--font-text)', fontSize: 'var(--text-sm)' },
  '.cm-diagnostic': { borderLeft: 'none', padding: 'var(--space-2) var(--space-3)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', maxHeight: '14rem', padding: 'var(--space-1)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '2px var(--space-2)', borderRadius: 'var(--radius-inner)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)' },
  '.cm-completionIcon': { display: 'none' },
  '.cm-completionDetail': { fontStyle: 'normal', opacity: '0.7', marginLeft: 'var(--space-3)' },
  '.cm-panels': { backgroundColor: 'var(--color-paper)', color: 'var(--color-ink)', fontFamily: 'var(--font-text)', fontSize: 'var(--text-sm)' },
  '.cm-panels.cm-panels-top': { borderBottom: 'var(--rule)' },
  '.cm-panel.cm-search': { padding: 'var(--space-2) var(--space-3)' },
  '.cm-panel.cm-search label': { fontSize: 'var(--text-xs)', color: soft },
  '.cm-panel.cm-search [name=close]': { color: 'var(--color-ink)', fontSize: '1.125rem', padding: '0 var(--space-2)' },
  '.cm-textfield': { border: 'var(--rule-control)', borderRadius: 'var(--radius)', backgroundColor: 'var(--color-paper)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', padding: '3px var(--space-2)' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--color-paper)', border: '1px solid var(--color-ink)', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)', fontWeight: '500', padding: '3px var(--space-2)' },
  '.cm-searchMatch': { backgroundColor: 'transparent', outline: '1px solid var(--color-ink-soft)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--color-line)', outline: '1px solid var(--color-ink)' },
  '.cm-placeholder': { color: soft },
})

const liquidMark = K.Decoration.mark({ class: 'cm-liquid' })
const liquidNodes = ['Interpolation', 'Tag', 'EndTag', 'Comment']
function markLiquid(view) {
  const builder = new K.RangeSetBuilder()
  for (const { from, to } of view.visibleRanges) {
    K.syntaxTree(view.state).iterate({ from, to, enter: (node) => {
      if (!liquidNodes.includes(node.name))
        return
      builder.add(node.from, node.to, liquidMark)
      return false
    } })
  }
  return builder.finish()
}
const liquidMarks = K.ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = markLiquid(view) }
  update(update) {
    if (update.docChanged || update.viewportChanged || K.syntaxTree(update.startState) !== K.syntaxTree(update.state))
      this.decorations = markLiquid(update.view)
  }
}, { decorations: plugin => plugin.decorations })

const describe = value => Array.isArray(value) ? `list of ${value.length}` : value === null ? 'null' : typeof value === 'object' ? 'object' : typeof value
function propertiesAt(context, path) {
  const at = path.reduce((value, key) => Array.isArray(value) ? ({ first: value[0], last: value.at(-1) })[key] : value?.[key], context)
  if (Array.isArray(at))
    return ['first', 'last', 'size'].map(label => ({ label, type: 'property' }))
  return at && typeof at === 'object' ? Object.entries(at).map(([label, value]) => ({ label, type: 'property', detail: describe(value) })) : []
}
function language(mode, context = {}) {
  if (mode === 'liquid') {
    return K.liquid({
      base: K.html(),
      variables: Object.entries(context).map(([label, value]) => ({ label, type: 'variable', detail: describe(value) })),
      filters: FILTERS.map(label => ({ label, type: 'function', detail: 'Kuroshiro' })),
      properties: path => propertiesAt(context, path),
    })
  }
  return { html: K.html, json: K.json, javascript: K.javascript }[mode]()
}

function makeEditor({ parent, doc, mode, label, lines = true, context, onChange, onSave }) {
  const lang = new K.Compartment()
  const lock = new K.Compartment()
  const extensions = [
    lines ? [K.lineNumbers(), K.highlightActiveLineGutter()] : [],
    mode === 'liquid' || mode === 'html' ? K.lintGutter() : [],
    mode === 'json' ? K.linter(K.jsonParseLinter(), { delay: 600 }) : [],
    mode === 'liquid' ? liquidMarks : [],
    K.history(), K.indentOnInput(), K.bracketMatching(), K.closeBrackets(), K.autocompletion(), K.search({ top: true }),
    K.EditorView.lineWrapping, K.indentUnit.of('  '), K.syntaxHighlighting(hankoHighlight), hankoTheme,
    lang.of(language(mode, context)), lock.of(K.EditorState.readOnly.of(false)),
    K.keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { onSave?.(); return true } }, ...K.closeBracketsKeymap, ...K.defaultKeymap, ...K.searchKeymap, ...K.historyKeymap, ...K.completionKeymap, K.indentWithTab]),
    K.EditorView.updateListener.of((update) => { if (update.docChanged) onChange?.(update.state.doc.toString()) }),
    K.EditorView.contentAttributes.of({ 'aria-label': label, 'spellcheck': 'false' }),
  ]
  const newState = text => K.EditorState.create({ doc: text, extensions })
  const view = new K.EditorView({ parent, state: newState(doc) })
  return {
    view,
    newState,
    text: () => view.state.doc.toString(),
    setContext: next => view.dispatch({ effects: lang.reconfigure(language(mode, next)) }),
    setLocked: locked => view.dispatch({ effects: lock.reconfigure(K.EditorState.readOnly.of(locked)) }),
    mark: problem => view.dispatch(K.setDiagnostics(view.state, problem ? [{ from: Math.min(problem.from, view.state.doc.length), to: Math.min(problem.to, view.state.doc.length), severity: 'error', message: problem.message }] : [])),
    goTo: (problem) => {
      view.dispatch({ selection: { anchor: Math.min(problem.from, view.state.doc.length) }, scrollIntoView: true })
      view.focus()
    },
  }
}

/* ── the bench: one editor, one preview ── */

const targetOf = (b) => {
  if (b.target.device) {
    const d = allDevices.find(x => x.id === b.target.device)
    return { model: d.model, palette: d.palette, device: d }
  }
  return b.target
}
function startTarget(assigned) {
  const first = devices().find(d => assigned.includes(d.id)) ?? devices()[0]
  return first ? { device: first.id } : { model: 'og_plus', palette: 'gray-4' }
}

function contextOf(b) {
  const { device } = targetOf(b)
  const p = b.plugin
  const base = {
    trmnl: { system: { timestamp_utc: 1790941200 }, plugin_settings: { instance_name: p.name, strategy: p.kind === 'Webhook' ? 'webhook' : 'polling', dark_mode: 'no', no_screen_padding: 'no' }, user: { id: 'kuroshiro-user', locale: 'en' } },
    sensors: device?.sensors ?? {},
  }
  if (p.kind === 'Webhook')
    return { ...base, ...p.payload }
  const sources = Object.fromEntries(b.draft.sources.map(s => [s.name, state.data === 'failed' ? { error: true, message: 'HTTP 503 Service Unavailable' } : p.data[s.name]]))
  return { ...base, ...b.draft.values, ...sources }
}

function drawFrame(b, html) {
  const frame = $('#frame')
  const target = targetOf(b)
  const model = MODELS[target.model]
  const next = document.createElement('iframe')
  next.className = 'next'
  next.setAttribute('sandbox', 'allow-scripts')
  next.title = b.kind === 'html' ? `Preview of ${b.title}` : `Preview of ${b.plugin.name}`
  next.style.cssText = `width:${model.w}px;height:${model.h}px;transform:scale(var(--s))`
  next.srcdoc = shellDoc(target, html, b.layout)
  next.addEventListener('load', () => {
    frame.querySelectorAll('iframe').forEach(old => old !== next && old.remove())
    next.classList.remove('next')
  }, { once: true })
  frame.querySelectorAll('iframe.next').forEach(old => old.remove())
  frame.append(next)
  b.drawn = true
}

function sizeFrame(b) {
  const frame = $('#frame')
  const model = MODELS[targetOf(b).model]
  frame.style.aspectRatio = `${model.w} / ${model.h}`
  frame.style.setProperty('--s', frame.clientWidth / model.w)
}

function frameNote(b, text) {
  const frame = $('#frame')
  frame.querySelector('.note')?.remove()
  frame.classList.toggle('dim', Boolean(text) && b.drawn)
  if (text)
    frame.insertAdjacentHTML('beforeend', `<span class="note">${icon('i-problem')}${text}</span>`)
}

async function renderPreview(b) {
  const frame = $('#frame')
  const waiting = b.kind === 'plugin' && (state.data === 'fetching' || state.data === 'down') && !b.fetchedAt
  frame.classList.toggle('rendering', waiting)
  if (waiting) {
    frame.querySelector('.note')?.remove()
    if (state.data === 'fetching')
      frame.insertAdjacentHTML('beforeend', `<span class="note">${busy}Fetching the data</span>`)
    return
  }
  const source = b.editor.text()
  if (b.kind === 'html') {
    drawFrame(b, source)
    return
  }
  if (!source.trim()) {
    setProblem(b, { line: 1, col: 1, from: 0, to: 0, message: 'A template cannot be empty.', parse: true, empty: true })
    return
  }
  try {
    const html = await engine.parseAndRender(source, contextOf(b))
    drawFrame(b, html)
    setProblem(b, null)
  }
  catch (error) {
    setProblem(b, problemOf(error, source))
  }
}

function setProblem(b, problem) {
  clearTimeout(b.problemTimer)
  const show = () => {
    b.problem = problem
    b.problems[b.layout] = problem
    b.editor.mark(problem && !problem.empty ? problem : null)
    $('#ed').dataset.invalid = Boolean(problem?.parse)
    frameNote(b, problem ? (b.drawn ? 'Not drawn. This is the last drawing.' : 'Not drawn.') : '')
    paintStrip(b)
    paintSaveBar(b)
  }
  if (problem && b.typing)
    b.problemTimer = setTimeout(show, 700)
  else
    show()
}

function schedulePreview(b) {
  b.typing = true
  clearTimeout(b.renderTimer)
  b.renderTimer = setTimeout(() => {
    renderPreview(b).then(() => { b.typing = false })
  }, 300)
}

function refetch(b, delay = 800) {
  clearTimeout(b.fetchTimer)
  b.fetchTimer = setTimeout(() => {
    b.fetching = true
    paintMeta(b)
    setTimeout(() => {
      b.fetching = false
      b.fetchedAt = Date.now()
      b.editor.setContext(contextOf(b))
      paintMeta(b)
      renderPreview(b)
    }, 700)
  }, delay)
}

/* ── painting the parts that change ── */

function paintStrip(b) {
  const strip = $('#strip')
  if (b.locked) {
    strip.innerHTML = `<span>This template is removed when you save.</span>`
    return
  }
  strip.innerHTML = b.problem
    ? `<span class="problem" role="alert">${icon('i-problem')}<span>${b.problem.empty ? '' : `Line ${b.problem.line}: `}<code>${esc(b.problem.message)}</code></span></span>${b.problem.empty ? '' : `<button class="btn quiet" data-act="goto">Go to line ${b.problem.line}</button>`}`
    : `<span><kbd>Tab</kbd> indents. <kbd>Esc</kbd> then <kbd>Tab</kbd> moves on.</span><span>${b.kind === 'html' ? 'HTML' : 'Liquid and HTML'}</span>`
}

function paintTplBar(b) {
  const bar = $('#tplbar')
  if (!bar)
    return
  const have = Object.keys(LAYOUTS).filter(l => l in b.draft.templates)
  const missing = Object.keys(LAYOUTS).filter(l => !(l in b.draft.templates))
  const gone = b.draft.removed.includes(b.layout)
  const addMenu = missing.length
    ? `<span class="addmenu"><button class="btn quiet" aria-haspopup="menu" aria-expanded="${Boolean(b.adding)}" data-act="add-menu">${have.length === 1 ? 'Add a template for a Mashup slot' : 'Add a template'}</button>${b.adding ? `<div class="menu" role="menu">${missing.map(l => `<button role="menuitem" data-act="add-layout" data-id="${l}">${LAYOUTS[l].name}<span>${LAYOUTS[l].hint}</span></button>`).join('')}</div>` : ''}</span>`
    : ''
  bar.innerHTML = have.length === 1
    ? `<p class="about">One template. It is shown full screen and in every Mashup slot.</p>${addMenu}`
    : `<div class="seg" role="radiogroup" aria-label="Template">${have.map(l => `<button role="radio" aria-checked="${l === b.layout}" data-act="layout" data-id="${l}" ${b.draft.removed.includes(l) ? 'style="text-decoration:line-through"' : ''}>${LAYOUTS[l].name}${b.problems[l]?.parse ? ` ${icon('i-problem')}` : ''}</button>`).join('')}</div>
       <p class="about">${gone ? `Removed when you save. A ${LAYOUTS[b.layout].name.toLowerCase()} slot then shows the full template. <button class="btn quiet" style="min-height:0" data-act="restore-layout">Put back</button>` : `<b>${LAYOUTS[b.layout].name}</b>: ${LAYOUTS[b.layout].is}.${b.layout === 'full' ? '' : ` <button class="btn quiet" style="min-height:0" data-act="remove-layout">Remove this template</button>`}`}</p>
       ${addMenu}`
}

const ago = (at) => {
  const s = Math.round((Date.now() - at) / 1000)
  return s < 10 ? 'just now' : s < 60 ? `${Math.floor(s / 10) * 10} s ago` : `${Math.floor(s / 60)} min ago`
}
const json = value => esc(JSON.stringify(value, null, 2))

function dataRows(b) {
  const p = b.plugin
  const { device } = targetOf(b)
  const context = contextOf(b)
  const origin = (name) => {
    if (name === 'trmnl')
      return 'Kuroshiro'
    if (name === 'sensors')
      return device ? `${device.name}'s Sensors` : 'No Device, so no Sensors'
    if (p.kind === 'Webhook')
      return 'Webhook Payload'
    if (b.draft.sources.some(s => s.name === name))
      return context[name]?.error ? `<span class="problem">${icon('i-problem')}Data Source, not fetched</span>` : 'Data Source'
    return 'Field Value'
  }
  const order = [...Object.keys(context).filter(k => !['trmnl', 'sensors'].includes(k)), 'sensors', 'trmnl']
  return order.map((name) => {
    const value = context[name]
    if (value === null || typeof value !== 'object')
      return `<li><div class="plain"><code>${name}</code><span class="from"><span class="val">${json(value)}</span> · ${origin(name)}</span><span></span></div></li>`
    const open = b.openVars.includes(name)
    const empty = !Object.keys(value).length
    return `<li><details ${open ? 'open' : ''} data-var="${name}"><summary><code>${name}</code><span class="from">${origin(name)}</span>${icon('i-chev')}</summary>
      ${value.error ? `<p class="why">The preview's fetch failed: ${esc(value.message)}. The template reads an error marker in place of the data, as it would on the Device.</p>` : ''}
      ${empty ? `<p class="why">Empty.</p>` : `<div class="codeblock"><pre>${json(value)}</pre></div>`}</details></li>`
  }).join('')
}

function paintMeta(b) {
  const target = targetOf(b)
  const model = MODELS[target.model]
  const palette = PALETTES[target.palette]
  const who = target.device?.name ?? 'The Device'
  if (b.kind === 'html') {
    $('#pvmeta').innerHTML = `<p class="pvcap" style="margin-top:var(--space-3)">Preview for ${target.device.name} <span class="mono">· ${model.label} · ${model.w} × ${model.h} · ${palette.name}</span></p><p class="pvcap">Your browser draws this. ${who} shows it in ${palette.short}.</p>`
    return
  }
  const all = devices()
  const p = b.plugin
  const hasFetch = p.kind === 'Poll' && b.draft.sources.length > 0
  const names = Object.keys(contextOf(b)).length
  const failed = hasFetch && state.data === 'failed'
  const down = hasFetch && state.data === 'down'
  $('#pvmeta').innerHTML = `
    <div class="pvfor">
      ${all.length ? `<label class="label" for="pv-for">Preview for</label>
      <select class="in" id="pv-for" data-field="target">${all.map(d => `<option value="${d.id}" ${b.target.device === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}<option value="" ${b.target.device ? '' : 'selected'}>Another Device Model</option></select>` : `<span class="label">Preview for</span>`}
      ${b.target.device ? '' : `<select class="in" aria-label="Device Model" data-field="model">${Object.entries(MODELS).map(([id, m]) => `<option value="${id}" ${id === b.target.model ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
      <select class="in" aria-label="Palette" data-field="palette">${model.palettes.map(id => `<option value="${id}" ${id === b.target.palette ? 'selected' : ''}>${PALETTES[id].name}</option>`).join('')}</select>`}
    </div>
    <p class="pvcap"><span class="mono">${b.target.device ? `${model.label} · ` : ''}${model.w} × ${model.h}${b.target.device ? ` · ${palette.name}` : ''}</span></p>
    <p class="pvcap">Your browser draws this. ${who} shows it in ${palette.short}${b.layout === 'full' ? '' : `, in ${LAYOUTS[b.layout].is.replace('a Mashup', 'a Mashup; the other slots are left empty here')}`}.</p>
    ${down ? `<div class="pvnote" role="alert"><span><b>The data could not be fetched.</b> Kuroshiro's server is not answering.${b.fetchedAt ? ` The preview uses the data from ${ago(b.fetchedAt)}.` : ''}</span><button class="btn quiet" data-act="fetch">Try again</button></div>` : ''}
    ${failed ? b.draft.sources.map(s => `<div class="pvnote"><span class="problem">${icon('i-problem')}<span>The Data Source <code>${s.name}</code> could not be fetched: HTTP 503 Service Unavailable.</span></span></div>`).join('') : ''}
    <div class="tucked" data-state="${b.dataOpen ? 'open' : 'closed'}">
      <button aria-expanded="${b.dataOpen}" data-act="tuck-data"><span>Data<span class="count">${names} names${hasFetch && b.fetchedAt ? `, fetched ${ago(b.fetchedAt)}` : ''}</span></span>${icon('i-chev')}</button>
      ${b.dataOpen ? `<div>
        <ul class="vars">${dataRows(b)}</ul>
        <div class="datafoot">
          <span>${p.kind === 'Webhook' ? (p.payload ? `The stored Webhook Payload, received ${p.received}.` : 'Nothing received yet.') : hasFetch ? (b.fetching ? `<span class="loadline" role="status">${busy}Fetching the Data Sources</span>` : 'Fetched for this preview only. It does not move a Fetch Failure Streak.') : 'No Data Sources, so nothing is fetched.'}</span>
          ${hasFetch ? `<button class="btn" data-act="fetch" ${b.fetching ? 'disabled' : ''}>Fetch again</button>` : ''}
        </div>
      </div>` : ''}
    </div>`
}

const same = (a, c) => JSON.stringify(a) === JSON.stringify(c)
function dirtyParts(b) {
  if (b.kind === 'html')
    return b.editor.text() === b.saved ? [] : ['HTML']
  const live = Object.fromEntries(Object.entries(b.draft.templates).filter(([l]) => !b.draft.removed.includes(l)))
  return [
    !same(live, b.plugin.saved.templates) && 'template',
    !same(b.draft.sources, b.plugin.saved.sources) && 'Data Sources',
    !same(b.draft.values, b.plugin.saved.values) && 'Field Values',
  ].filter(Boolean)
}
const blocking = b => Object.entries(b.problems).filter(([l, problem]) => problem?.parse && !b.draft.removed.includes(l))

function paintSaveBar(b) {
  const slot = $('#savebar')
  if (!slot || b.kind === 'html')
    return
  const parts = dirtyParts(b)
  const stop = blocking(b)
  slot.innerHTML = !parts.length
    ? ''
    : `<div class="savebar" role="region" aria-label="Unsaved changes">${stop.length
      ? `<p><b>${stop.length} thing${stop.length > 1 ? 's' : ''} to fix before this can be saved.</b> <button class="btn quiet" style="min-height:0" data-act="show-first">Show the first</button></p>`
      : `<p><b>Unsaved changes</b> to the ${list(parts)}. The preview already shows them.</p>`}
      <div class="btnrow"><button class="btn quiet" data-act="discard">Discard changes</button><button class="btn primary" data-act="save">Save Plugin</button></div></div>`
}

/* ── pages ── */

function shell(section, body) {
  const all = devices()
  const nav = `${all.map(d => `<a href="#/devices/${d.id}/html" ${section === d.id ? 'aria-current="page"' : ''}>${d.name}</a>`).join('')}<a href="#/plugins/weather">Connect a Device</a>`
  return `
    <header class="bar">
      <a class="lockup" href="#/plugins/weather">${seal(26)}<span class="wordmark">Kuroshiro</span></a>
      <nav aria-label="Sections">${nav}<i></i><a href="#/plugins/weather" ${section === 'plugins' ? 'aria-current="page"' : ''}>Plugins</a><a href="#/plugins/weather">Instance</a></nav>
    </header>
    <main class="col">${body}</main>
    <nav class="btabs" aria-label="Sections">
      <a href="#/devices/kitchen/html" ${section !== 'plugins' ? 'aria-current="page"' : ''}>${all.length === 1 ? all[0].name : all.length ? 'Devices' : 'Connect'}</a>
      <a href="#/plugins/weather" ${section === 'plugins' ? 'aria-current="page"' : ''}>Plugins</a>
      <a href="#/plugins/weather">Instance</a>
    </nav>`
}

const benchMarkup = `
  <div class="bench2">
    <div class="codeed main" id="ed"><div class="cm" id="cm"></div><div class="strip" id="strip"></div></div>
    <div class="pv"><span class="plate hero pvframe" id="frame"></span><div id="pvmeta"></div></div>
  </div>`

const SCHED = { at: '06:15', message: 'undefined method "round" for an error marker', line: 5 }

function sourceMarkup(p, s) {
  return `
    <ul class="rows" style="border-top:var(--rule)"><li>
      <div class="dsrow is-open">
        <span><button class="open" aria-expanded="true">${s.name}</button></span>
        <span class="what">${s.method} ${esc(s.url.replace('https://', ''))}</span>
        <span class="health">Fetched 4 min ago</span>
        <span class="chev" aria-hidden="true">${icon('i-chev')}</span>
      </div>
      <div class="dsdetail">
        <div class="fields">
          <div class="field"><span class="label">Request</span><span class="urlline"><select class="in" aria-label="Method"><option>GET</option><option>POST</option></select><input class="in wide" aria-label="URL" value="${esc(s.url)}" data-field="source-url"></span><span class="hint">The response must be JSON. A Field Value can be used as <code>{{ keyname }}</code> here, in the headers and in the body.</span></div>
          <div class="field"><span class="label" id="l-headers">Headers</span><div class="codeed input" id="ed-headers"><div class="cm"></div></div><span class="msg" id="msg-headers" role="alert" hidden></span><span class="hint">A JSON object. Keep a secret in a password Plugin Field and name it here, not in the header itself.</span></div>
          <div class="tucked" data-state="open"><button aria-expanded="true"><span>Transform · JavaScript, 4 lines</span>${icon('i-chev')}</button><div>
            <p>JavaScript that reshapes the response before the template sees it. It runs on this server at every fetch.</p>
            <div class="codeed input" id="ed-transform" style="margin-top:var(--space-3)"><div class="cm"></div></div>
          </div></div>
        </div>
        <div class="side"><p>Fetched 4 min ago, at the last scheduled render.</p><div class="btnrow"><button class="btn">Remove Data Source</button></div></div>
      </div>
    </li></ul>`
}

function valueControl(b, f) {
  const value = b.draft.values[f.key]
  return {
    text: () => `<input class="in text w" value="${esc(value ?? '')}" data-field="value" data-key="${f.key}">`,
    select: () => `<select class="in" data-field="value" data-key="${f.key}">${f.options.map(o => `<option ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`,
    switch: () => `<button class="sw" role="switch" aria-checked="${Boolean(value)}" aria-label="${esc(f.label)}" data-act="switch" data-id="${f.key}"></button><span>${value ? 'On' : 'Off'}</span>`,
  }[f.type]()
}
const valuesMarkup = b => b.plugin.fields.map(f => `<li class="set"><b>${f.label}${f.required ? '<span class="req">required</span>' : ''}</b><span class="ctl">${valueControl(b, f)}</span><span class="note">${f.def != null && b.draft.values[f.key] === f.def ? 'The default' : ''}</span>${f.help ? `<span class="hint">${f.help}</span>` : ''}</li>`).join('')

function pluginPage(p) {
  const b = {
    kind: 'plugin', plugin: p, layout: 'full', problems: {}, openVars: [], dataOpen: state.wide, states: {},
    draft: { ...structuredClone(p.saved), removed: [] },
    target: startTarget(p.on), fetchedAt: state.data === 'ok' || state.data === 'failed' ? Date.now() : null,
  }
  const names = devices().filter(d => p.on.includes(d.id)).map(d => d.name)
  const sched = state.sched && p.id === 'weather'
  $('#app').innerHTML = shell('plugins', `
    <a class="back" href="#/plugins/weather" style="margin:0 0 var(--space-3)">${icon('i-chev')}All Plugins</a>
    <div class="head"><h1 class="title-lg">${p.name}</h1></div>
    <p class="pfacts"><span>${p.kind} Plugin</span><span>${p.kind === 'Poll' ? `Fetches every ${p.every}` : `Last received ${p.received}`}</span><span>${names.length ? `On ${list(names)}` : 'Not on a Device'}</span>${p.recipe ? `<span>From the Recipe ${p.recipe}</span>` : ''}</p>
    <div id="once">${p.fresh ? `<p class="once"><span>Created. It shows its name until you write its template.</span><button class="btn quiet" style="min-height:0" data-act="dismiss">Dismiss</button></p>` : ''}</div>
    ${sched ? `<ul class="problems"><li><span class="problem">${icon('i-problem')}The template could not be rendered at ${SCHED.at}: ${SCHED.message}</span><a href="#/plugins/${p.id}" data-act="jump-template">Open the template</a></li></ul>` : ''}
    <section class="tplsection" id="template">
      <h2 class="title-sm section"><span>Template <span class="of">of ${p.name}</span></span><span class="actions"><button class="btn wideonly" data-act="wide">${state.wide ? 'Back to the page' : 'Full window'}</button></span></h2>
      ${sched ? `<ul class="problems tplsched"><li><span class="problem">${icon('i-problem')}<span>The scheduled render at ${SCHED.at} failed at line ${SCHED.line}: <code>${SCHED.message}</code>. <span class="after">The preview draws with the data fetched now, so it may not fail the same way.</span></span></span><button class="btn quiet" style="min-height:0" data-act="goto-sched">Go to line ${SCHED.line}</button></li></ul>` : ''}
      <div class="tplbar" id="tplbar"></div>
      ${benchMarkup}
    </section>
    ${p.kind === 'Poll' ? `<h2 class="title-sm section" id="data"><span>Data Sources</span><span class="actions"><button class="btn">Add a Data Source</button></span></h2>
      ${b.draft.sources.length ? sourceMarkup(p, b.draft.sources[0]) : `<div class="empty" style="border-top:var(--rule)"><p>No Data Sources. The template renders without data. Add one to fetch JSON from an address, or to keep a fixed value.</p></div>`}` : ''}
    ${p.fields.length ? `<h2 class="title-sm section" id="values">Field Values</h2><ul id="valuerows">${valuesMarkup(b)}</ul>` : ''}
    <p class="protonote">Prototype: the rest of the Plugin page (${p.kind === 'Webhook' ? 'Webhook, ' : ''}Devices, Recipe and the tucked sections) is drawn in the Plugins surfaces prototype and left out here. Try <a href="#/plugins/weather">Weather</a>, a just-built <a href="#/plugins/sourdough">Sourdough timer</a>, the Webhook-kind <a href="#/plugins/doorbell">Doorbell note</a>, or a Screen's <a href="#/devices/kitchen/html">HTML</a>.</p>
    <div id="savebar"></div>`)

  b.editor = makeEditor({
    parent: $('#cm'), doc: b.draft.templates.full, mode: 'liquid', label: `Template of ${p.name}, ${LAYOUTS.full.name}`, context: contextOf(b),
    onChange: (text) => {
      b.draft.templates[b.layout] = text
      paintSaveBar(b)
      schedulePreview(b)
    },
    onSave: () => actions.save(),
  })
  if (b.draft.sources.length) {
    const s = b.draft.sources[0]
    b.headers = makeEditor({ parent: $('#ed-headers .cm'), doc: s.headers, mode: 'json', label: 'Headers', lines: false, onChange: (text) => {
      s.headers = text
      paintSaveBar(b)
      refetch(b)
    }, onSave: () => actions.save() })
    b.headers.view.contentDOM.addEventListener('blur', () => {
      const reason = (() => { try { const v = JSON.parse(s.headers); return v && typeof v === 'object' && !Array.isArray(v) ? '' : 'x' } catch { return 'x' } })()
      $('#ed-headers').dataset.invalid = Boolean(reason)
      $('#msg-headers').hidden = !reason
      $('#msg-headers').textContent = reason && 'Headers must be a JSON object, like { "Accept": "application/json" }.'
    })
    b.transform = makeEditor({ parent: $('#ed-transform .cm'), doc: s.transform, mode: 'javascript', label: 'Transform', onChange: (text) => {
      s.transform = text
      paintSaveBar(b)
      refetch(b)
    }, onSave: () => actions.save() })
  }
  return b
}

function htmlPage(screen) {
  const device = allDevices.find(d => d.id === screen.device)
  const b = { kind: 'html', title: screen.name, saved: screen.html, layout: 'full', problems: {}, target: { device: device.id } }
  $('#app').innerHTML = shell(device.id, `
    <a class="back" href="#/devices/${device.id}/html" style="margin:0 0 var(--space-3)">${icon('i-chev')}${device.name}</a>
    <div class="head"><h1 class="title-lg">Edit HTML</h1></div>
    <p class="pfacts"><span>${screen.name}</span><span>An HTML Screen on ${device.name}</span></p>
    <section class="tplsection">${benchMarkup}</section>
    <div class="btnrow htmlfoot"><button class="btn primary" data-act="save-html">Save Screen</button><a class="btn quiet" href="#/devices/${device.id}/html">Cancel</a><span id="htmlstatus"></span></div>
    <p class="protonote">Prototype: the same code editor in its HTML mode, on the page the Device spec calls "Edit HTML". Nothing is Liquid here, so there is no data and nothing to mark. Back to <a href="#/plugins/weather">Weather</a>.</p>`)
  b.editor = makeEditor({ parent: $('#cm'), doc: screen.html, mode: 'html', label: `HTML of ${screen.name}`, onChange: () => schedulePreview(b), onSave: () => actions['save-html']() })
  return b
}

function mount() {
  clearTimeout(page?.renderTimer)
  clearTimeout(page?.fetchTimer)
  const [a, id] = (location.hash.replace(/^#/, '') || '/plugins/weather').split('/').filter(Boolean)
  document.documentElement.dataset.theme = state.theme
  page = a === 'devices' ? htmlPage(htmlScreens[0]) : pluginPage(allPlugins.find(p => p.id === id) ?? allPlugins[0])
  document.body.classList.toggle('wide', state.wide && page.kind === 'plugin')
  document.title = `PROTOTYPE: ${page.kind === 'html' ? 'Edit HTML' : page.plugin.name}`
  new ResizeObserver(() => sizeFrame(page)).observe($('#frame'))
  sizeFrame(page)
  paintTplBar(page)
  paintStrip(page)
  paintMeta(page)
  paintSaveBar(page)
  renderPreview(page)
  paintProto()
}

function paintProto() {
  const label = { theme: state.theme === 'dark' ? 'Dark' : 'Light', devices: `${state.count} Device${state.count === 1 ? '' : 's'}`, data: { ok: 'Data fetched', failed: 'A fetch failed', fetching: 'Fetching', down: 'Server down' }[state.data], sched: state.sched ? 'Scheduled render failed' : 'Scheduled render fine' }
  Object.entries(label).forEach(([key, text]) => { $(`[data-cycle="${key}"]`).textContent = text })
  const query = new URLSearchParams({ theme: state.theme, devices: state.count, data: state.data, sched: state.sched ? 1 : 0, wide: state.wide ? 1 : 0 })
  history.replaceState(null, '', `?${query}${location.hash}`)
}

function switchLayout(b, layout) {
  b.states[b.layout] = b.editor.view.state
  b.layout = layout
  b.editor.view.setState(b.states[layout] ?? b.editor.newState(b.draft.templates[layout]))
  b.editor.setContext(contextOf(b))
  b.locked = b.draft.removed.includes(layout)
  b.editor.setLocked(b.locked)
  b.problem = b.problems[layout] ?? null
  b.adding = false
  paintTplBar(b)
  paintMeta(b)
  renderPreview(b)
  paintStrip(b)
}

const actions = {
  'wide': () => {
    state.wide = !state.wide
    document.body.classList.toggle('wide', state.wide)
    document.querySelector('[data-act="wide"]').textContent = state.wide ? 'Back to the page' : 'Full window'
    if (state.wide && !page.dataOpen) {
      page.dataOpen = true
      paintMeta(page)
    }
    requestAnimationFrame(() => sizeFrame(page))
    paintProto()
  },
  'goto': () => page.editor.goTo(page.problem),
  'goto-sched': () => {
    const line = page.editor.view.state.doc.line(SCHED.line)
    page.editor.goTo({ from: line.from })
  },
  'jump-template': (el, e) => {
    e.preventDefault()
    $('#template').scrollIntoView({ block: 'start' })
    actions['goto-sched']()
  },
  'layout': el => switchLayout(page, el.dataset.id),
  'add-menu': () => {
    page.adding = !page.adding
    paintTplBar(page)
  },
  'add-layout': (el) => {
    page.draft.templates[el.dataset.id] = page.draft.templates.full
    switchLayout(page, el.dataset.id)
    paintSaveBar(page)
    page.editor.view.focus()
  },
  'remove-layout': () => {
    page.draft.removed.push(page.layout)
    switchLayout(page, page.layout)
    paintSaveBar(page)
  },
  'restore-layout': () => {
    page.draft.removed = page.draft.removed.filter(l => l !== page.layout)
    switchLayout(page, page.layout)
    paintSaveBar(page)
  },
  'tuck-data': () => {
    page.dataOpen = !page.dataOpen
    paintMeta(page)
  },
  'fetch': () => {
    if (state.data === 'down')
      state.data = 'ok'
    refetch(page, 0)
    paintProto()
  },
  'switch': (el) => {
    page.draft.values[el.dataset.id] = !page.draft.values[el.dataset.id]
    $('#valuerows').innerHTML = valuesMarkup(page)
    page.editor.setContext(contextOf(page))
    paintMeta(page)
    paintSaveBar(page)
    renderPreview(page)
  },
  'show-first': () => {
    const [layout, problem] = blocking(page)[0]
    if (layout !== page.layout)
      switchLayout(page, layout)
    $('#template').scrollIntoView({ block: 'start' })
    if (problem.empty)
      page.editor.view.focus()
    else
      page.editor.goTo(problem)
  },
  'discard': () => {
    location.hash ||= '#/plugins/weather'
    mount()
  },
  'save': () => {
    if (!dirtyParts(page).length)
      return
    if (blocking(page).length) {
      paintSaveBar(page)
      return
    }
    const p = page.plugin
    page.draft.removed.forEach((l) => { delete page.draft.templates[l] })
    const { removed, ...rest } = page.draft
    p.saved = structuredClone(rest)
    const names = devices().filter(d => p.on.includes(d.id)).map(d => d.name)
    const keep = page.layout in p.saved.templates ? page.layout : 'full'
    page.draft.removed = []
    if (keep !== page.layout)
      switchLayout(page, keep)
    paintTplBar(page)
    $('#once').innerHTML = `<p class="once" role="status"><span>${icon('i-check')}</span><span style="flex:1">Saved at ${clock()}.${names.length ? ` Fetched and rendered again for ${list(names)}.` : ''}</span></p>`
    paintSaveBar(page)
  },
  'save-html': () => {
    page.saved = page.editor.text()
    htmlScreens[0].html = page.saved
    $('#htmlstatus').innerHTML = `<span class="status" role="status">${icon('i-check')}Saved</span>`
    setTimeout(() => { if ($('#htmlstatus')) $('#htmlstatus').innerHTML = '' }, 2000)
  },
  'dismiss': () => { $('#once').innerHTML = '' },
}

const fields = {
  target: (el) => {
    page.target = el.value ? { device: el.value } : { model: targetOf(page).model, palette: targetOf(page).palette }
  },
  model: (el) => { page.target = { model: el.value, palette: MODELS[el.value].palettes[0] } },
  palette: (el) => { page.target = { ...page.target, palette: el.value } },
}

document.addEventListener('click', (e) => {
  const cycle = e.target.closest('[data-cycle]')
  if (cycle)
    return cycles[cycle.dataset.cycle]()
  const el = e.target.closest('[data-act]')
  if (el && actions[el.dataset.act])
    return actions[el.dataset.act](el, e)
  if (page?.adding) {
    page.adding = false
    paintTplBar(page)
  }
})
document.addEventListener('change', (e) => {
  const field = e.target.dataset?.field
  if (!fields[field])
    return
  fields[field](e.target)
  sizeFrame(page)
  page.editor.setContext(contextOf(page))
  paintMeta(page)
  renderPreview(page)
  $(`[data-field="${field}"]`)?.focus()
})
document.addEventListener('input', (e) => {
  const field = e.target.dataset?.field
  if (field === 'value') {
    page.draft.values[e.target.dataset.key] = e.target.value
    page.editor.setContext(contextOf(page))
    paintSaveBar(page)
    schedulePreview(page)
    refetch(page)
  }
  if (field === 'source-url') {
    page.draft.sources[0].url = e.target.value
    paintSaveBar(page)
    refetch(page)
  }
})
document.addEventListener('toggle', (e) => {
  const name = e.target.dataset?.var
  if (!name || !page.openVars)
    return
  page.openVars = e.target.open ? [...new Set([...page.openVars, name])] : page.openVars.filter(v => v !== name)
}, true)

const next = (all, value) => all[(all.indexOf(value) + 1) % all.length]
const cycles = {
  theme: () => {
    state.theme = next(['light', 'dark'], state.theme)
    document.documentElement.dataset.theme = state.theme
    paintProto()
  },
  devices: () => {
    state.count = next([3, 1, 0], state.count)
    mount()
  },
  data: () => {
    state.data = next(['ok', 'failed', 'fetching', 'down'], state.data)
    mount()
  },
  sched: () => {
    state.sched = !state.sched
    mount()
  },
}
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, .cm-editor') || e.metaKey || e.ctrlKey || e.altKey)
    return
  const key = { t: 'theme', d: 'devices', f: 'data', r: 'sched' }[e.key]
  if (key)
    cycles[key]()
  if (e.key === 'w' && page.kind === 'plugin')
    actions.wide()
})
window.addEventListener('hashchange', mount)
mount()
