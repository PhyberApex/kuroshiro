import type { CalendarClock } from './ics-calendar.js'
import { XMLParser } from 'fast-xml-parser'
import { parseIcs } from './ics-calendar.js'

const XML_TYPES = /^(?:text\/xml|application\/xml|application\/[\w.+-]+\+xml)$/i
const BYTE_ORDER_MARK = '﻿'
const TEXT = '__content__'

type XmlNode = string | null | XmlNode[] | { [key: string]: XmlNode }

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: TEXT,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  cdataPropName: false,
  processEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
})

/**
 * The shape Rails' `Hash.from_xml` gives a document, which TRMNL reads a polled feed as (ADR-0059): an element with
 * text is that text, attributes dropped; an element with children or attributes is an object of them; a repeated
 * child is a list; an empty element is nothing.
 */
function asFromXml(node: unknown): XmlNode {
  if (Array.isArray(node))
    return node.map(asFromXml)
  if (typeof node !== 'object' || node === null)
    return typeof node === 'string' && node !== '' ? node : null
  const record = node as Record<string, unknown>
  const text = record[TEXT]
  if (typeof text === 'string' && text !== '')
    return text
  const children = Object.entries(record).filter(([key]) => key !== TEXT)
  return children.length === 0 ? null : Object.fromEntries(children.map(([key, child]) => [key, asFromXml(child)]))
}

function parseXml(text: string): XmlNode | undefined {
  try {
    const parsed = asFromXml(xmlParser.parse(text))
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0 ? parsed : undefined
  }
  catch {
    return undefined
  }
}

/** One cell and what ends it: a comma, a line break of either kind, or the end of the text. */
const CSV_CELL = /("(?:[^"]|"")*"|[^,\r\n]*)(,|\r\n|[\r\n]|$)/y

const unquoted = (cell: string) => cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell

/** The rows of a CSV body, each a list of cells, with RFC 4180 quoting: a quoted cell may hold the separator, a line break and a doubled quote. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  CSV_CELL.lastIndex = 0
  while (CSV_CELL.lastIndex < text.length) {
    const [, cell, ending] = CSV_CELL.exec(text) ?? ['', '', '']
    row.push(unquoted(cell))
    if (ending === ',')
      continue
    rows.push(row)
    row = []
    if (ending === '')
      break
  }
  return row.length > 0 ? [...rows, row] : rows
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return undefined
  }
}

const CALENDAR_START = /^\s*BEGIN:VCALENDAR/i

const mediaTypeOf = (contentType: string | null) => (contentType ?? '').split(';')[0]?.trim() ?? ''

/**
 * What a fetched body is to a Template and a transform, read as TRMNL reads it (ADR-0059): JSON as JSON whatever the
 * content type says, an XML type as an object in `Hash.from_xml`'s shape, `text/csv` as rows under `data`, `text/calendar` or
 * a body that starts as a calendar as its events under `events` (ADR-0066), an empty body as nothing, and anything else as
 * its text.
 */
export function parseResponseBody(body: string, contentType: string | null, clock: CalendarClock): unknown {
  const text = body.startsWith(BYTE_ORDER_MARK) ? body.slice(1) : body
  if (text.trim() === '')
    return null
  const json = parseJson(text)
  if (json !== undefined)
    return json
  const mediaType = mediaTypeOf(contentType)
  if (XML_TYPES.test(mediaType))
    return parseXml(text) ?? text
  if (mediaType === 'text/calendar' || CALENDAR_START.test(text))
    return parseIcs(text, clock) ?? text
  if (mediaType === 'text/csv')
    return { data: parseCsv(text) }
  return text
}
