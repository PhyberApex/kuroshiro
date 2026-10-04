import { Buffer } from 'node:buffer'
import { isUUID } from 'class-validator'

/** The place of an entry in the order of a Device Log: its date, then its id. */
export interface LogPosition {
  date: Date
  id: string
}

const SEPARATOR = '_'

export function encodeCursor({ date, id }: LogPosition): string {
  return Buffer.from(`${date.toISOString()}${SEPARATOR}${id}`).toString('base64url')
}

export function decodeCursor(cursor: string): LogPosition | null {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split(SEPARATOR)
  const date = new Date(iso)
  return !Number.isNaN(date.getTime()) && isUUID(id) ? { date, id } : null
}
