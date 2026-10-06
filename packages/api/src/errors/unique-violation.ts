import { QueryFailedError } from 'typeorm'

const POSTGRES_UNIQUE_VIOLATION = '23505'

/** Whether `exception` is a Postgres unique violation, of the named constraint when one is given. */
export function isUniqueViolation(exception: unknown, constraint?: string): boolean {
  if (!(exception instanceof QueryFailedError))
    return false
  const driverError = exception.driverError as { code?: unknown, constraint?: unknown } | undefined
  if (driverError?.code !== POSTGRES_UNIQUE_VIOLATION)
    return false
  return constraint === undefined || driverError.constraint === constraint
}
