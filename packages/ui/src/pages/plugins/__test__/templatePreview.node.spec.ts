import type { ScreenShellTarget } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { previewOf } from '../templatePreview'

const target: ScreenShellTarget = {
  model: { cssClasses: ['screen--og_plus', 'screen--md'], cssVariables: { '--screen-w': '800px' } },
  palette: { frameworkClass: 'screen--2bit' },
}

const context = { location: 'Lindenplatz', trmnl: { plugin_settings: { instance_name: 'Weather' } } }

const preview = (markup: string, size: Parameters<typeof previewOf>[0]['size'] = 'full') => previewOf({ markup, size, context, target })

async function bodyOf(markup: string, size: Parameters<typeof previewOf>[0]['size']) {
  const outcome = await preview(markup, size)
  if (!('document' in outcome))
    throw new Error(`Not drawn: ${outcome.problem.message}`)
  return outcome.body
}

describe('the preview of a Template', () => {
  it('renders Liquid against the context and wraps it in the screen shell, as the server does', async () => {
    const outcome = await preview('<span class="title">{{ trmnl.plugin_settings.instance_name }} in {{ location | upcase }}</span>')

    expect(outcome).toEqual({
      document: `<html>
  <head>
    <link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
    <script src="https://usetrmnl.com/js/latest/plugins.js"></script>
  </head>
  <body class="environment trmnl">
    <div class="screen screen--og_plus screen--md screen--2bit" style="--screen-w: 800px;"><div class="view view--full"><span class="title">Weather in LINDENPLATZ</span></div></div>
  </body>
</html>`,
      body: '<div class="view view--full"><span class="title">Weather in LINDENPLATZ</span></div>',
    })
  })

  it('draws a Half horizontal Template at the top of two rows, the other slot empty', async () => {
    expect(await bodyOf('<p>{{ location }}</p>', 'half_horizontal'))
      .toBe('<div class="mashup mashup--1Tx1B"><div class="view view--half_horizontal"><p>Lindenplatz</p></div><div class="view view--half_horizontal"></div></div>')
  })

  it('draws a Half vertical Template at the left of two columns', async () => {
    expect(await bodyOf('<p>{{ location }}</p>', 'half_vertical'))
      .toBe('<div class="mashup mashup--1Lx1R"><div class="view view--half_vertical"><p>Lindenplatz</p></div><div class="view view--half_vertical"></div></div>')
  })

  it('draws a Quadrant Template at the top left of four', async () => {
    const empty = '<div class="view view--quadrant"></div>'

    expect(await bodyOf('<p>{{ location }}</p>', 'quadrant'))
      .toBe(`<div class="mashup mashup--2x2"><div class="view view--quadrant"><p>Lindenplatz</p></div>${empty}${empty}${empty}</div>`)
  })

  it('answers a Template that does not parse as a problem with its line, which stops a save', async () => {
    expect(await preview('<p>one</p>\n{% if rain %}\n<p>umbrella</p>'))
      .toEqual({ problem: { message: 'tag {% if rain %} not closed', line: 2 }, stopsSave: true })
  })

  it('answers an empty Template as a problem without a line', async () => {
    expect(await preview(' \n')).toEqual({ problem: { message: 'A template cannot be empty.', line: null }, stopsSave: true })
  })

  it('answers a Template that parses and fails against the data as a problem that stops no save', async () => {
    const outcome = await preview('<p>fine</p>\n{% render "shared" %}')

    expect(outcome).toMatchObject({ problem: { line: 2 }, stopsSave: false })
  })
})
