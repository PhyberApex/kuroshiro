import type { ArgumentMetadata, ValidationError } from '@nestjs/common'
import type { ApiErrorField } from 'kuroshiro-shared'
import { ValidationPipe } from '@nestjs/common'
import { ValidationException } from './api.exception.js'

export function toApiErrorFields(errors: ValidationError[], parentPath = ''): ApiErrorField[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property
    const own = Object.values(error.constraints ?? {}).map(message => ({ path, message }))
    return [...own, ...toApiErrorFields(error.children ?? [], path)]
  })
}

/**
 * A DTO class declares its fields, so every instance owns each of them as
 * `undefined` whatever `exposeUnsetFields` says. Removing those is what lets a
 * service tell "absent" from "set" by the key alone.
 */
function dropUnsetFields<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(dropUnsetFields)
  }
  else if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    Object.keys(record).forEach((key) => {
      if (record[key] === undefined)
        delete record[key]
      else
        dropUnsetFields(record[key])
    })
  }
  return value
}

export class ApiValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { exposeUnsetFields: false },
    })
  }

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const transformed = await super.transform(value, metadata)
    return metadata.type === 'body' ? dropUnsetFields(transformed) : transformed
  }

  createExceptionFactory() {
    return (errors: ValidationError[] = []) =>
      new ValidationException(toApiErrorFields(errors), this.flattenValidationErrors(errors))
  }
}
