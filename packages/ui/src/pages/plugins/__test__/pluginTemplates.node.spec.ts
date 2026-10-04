import type { TemplateProblem } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { ApiRefusal, ServerUnreachable } from '@/api/client'
import { buildApiError } from '@/testing/fixtures/errors'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { missingSizes, templatePaths, templatesPart, withTemplateAdded } from '../pluginTemplates'

const WEATHER = buildPluginDetail({
  templates: [
    { size: 'quadrant', liquidMarkup: '<p>quarter</p>' },
    { size: 'full', liquidMarkup: '<p>full</p>' },
  ],
})

const unclosed: TemplateProblem = { message: 'tag {% if rain %} not closed', line: 2 }
const liquid = (markup: string) => markup.includes('{% if rain %}') ? unclosed : null

const part = templatesPart(() => liquid)
const context = { plugin: WEATHER, unsaved: {} }

describe('the Templates of the Plugin\'s form', () => {
  it('saves the Templates and nothing else', () => {
    expect(part.keys).toEqual(['templates'])
  })

  it('holds one row per Template, Full first, whatever order the server stores them in', () => {
    expect(part.read(WEATHER).rows).toEqual([
      { key: 'full', size: 'full', liquidMarkup: '<p>full</p>', removed: false },
      { key: 'quadrant', size: 'quadrant', liquidMarkup: '<p>quarter</p>', removed: false },
    ])
  })

  it('sends the whole set by size, without a removed Template', () => {
    const { rows } = part.read(buildPluginDetail({
      templates: [
        { size: 'full', liquidMarkup: '<p>full</p>' },
        { size: 'half_vertical', liquidMarkup: '<p>half</p>' },
        { size: 'quadrant', liquidMarkup: '<p>quarter</p>' },
      ],
    }))
    rows[1]!.removed = true

    expect(part.toInput({ rows })).toEqual({
      templates: [
        { size: 'full', liquidMarkup: '<p>full</p>' },
        { size: 'quadrant', liquidMarkup: '<p>quarter</p>' },
      ],
    })
  })

  describe('adding a Template', () => {
    it('offers the sizes the Plugin has no Template of, a removed one not among them', () => {
      const { rows } = part.read(WEATHER)
      rows[1]!.removed = true

      expect(missingSizes(rows)).toEqual(['half_horizontal', 'half_vertical'])
    })

    it('starts the new Template as a copy of Full, in the order of the sizes', () => {
      const rows = withTemplateAdded(part.read(WEATHER).rows, 'half_vertical')

      expect(rows.map(row => row.size)).toEqual(['full', 'half_vertical', 'quadrant'])
      expect(rows[1]).toEqual({ key: 'half_vertical', size: 'half_vertical', liquidMarkup: '<p>full</p>', removed: false })
    })
  })

  describe('what stops a save', () => {
    it('is a Template Liquid cannot parse, at the path it is sent at and with its line', () => {
      const { rows } = part.read(WEATHER)
      rows[1]!.liquidMarkup = '<p>quarter</p>\n{% if rain %}'

      expect(part.validate!({ rows }, context)).toEqual([{ path: 'templates.1.liquidMarkup', message: 'tag {% if rain %} not closed', line: 2 }])
    })

    it('is an empty Template, also before the Liquid engine has arrived', () => {
      const early = templatesPart(() => undefined)
      const { rows } = early.read(WEATHER)
      rows[0]!.liquidMarkup = '  \n'
      rows[1]!.liquidMarkup = '{% if rain %}'

      expect(early.validate!({ rows }, context)).toEqual([{ path: 'templates.0.liquidMarkup', message: 'A template cannot be empty.', line: null }])
    })

    it('is not a removed Template, which has no path and moves the ones after it up', () => {
      const rows = withTemplateAdded(part.read(WEATHER).rows, 'half_vertical')
      rows[1]!.liquidMarkup = '{% if rain %}'
      rows[1]!.removed = true
      rows[2]!.liquidMarkup = '{% if rain %}'

      expect(templatePaths(rows)).toEqual(['templates.0.liquidMarkup', undefined, 'templates.1.liquidMarkup'])
      expect(part.validate!({ rows }, context).map(problem => problem.path)).toEqual(['templates.1.liquidMarkup'])
    })
  })

  describe('what a refused save says', () => {
    const refusal = (details: Record<string, unknown>) => new ApiRefusal(buildApiError({ statusCode: 400, code: 'template-invalid', details }))

    it('is the server\'s problem at the Template it names, with its line', () => {
      const draft = part.read(WEATHER)

      expect(part.refused!(refusal({ size: 'quadrant', line: 4, message: 'tag {% for %} not closed' }), draft))
        .toEqual([{ path: 'templates.1.liquidMarkup', message: 'tag {% for %} not closed', line: 4 }])
    })

    it('is nothing for a size the form does not send, and for any other failure', () => {
      const draft = part.read(WEATHER)

      expect(part.refused!(refusal({ size: 'half_vertical', line: 4, message: 'tag {% for %} not closed' }), draft)).toEqual([])
      expect(part.refused!(new ApiRefusal(buildApiError({ statusCode: 400, code: 'template-full-missing' })), draft)).toEqual([])
      expect(part.refused!(new ServerUnreachable(), draft)).toEqual([])
    })
  })
})
