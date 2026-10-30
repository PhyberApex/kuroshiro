import type { ExecutionContext } from '@nestjs/common'
import type { ClassConstructor } from 'class-transformer'
import type { ValidationError } from 'class-validator'
import type { Request } from 'express'
import { BadRequestException, createParamDecorator } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

function toMessage(error: ValidationError): string {
  return error.value === undefined
    ? `Missing header: ${error.property}`
    : `Invalid header: ${Object.values(error.constraints ?? {}).join(', ')}`
}

/**
 * The request headers, checked against `dto`. Nest runs no pipe on `@Headers()`,
 * so without this a Device-facing route never sees its header DTO's decorators
 * and a request without an `ID` header reaches the MAC lookup. A failed check
 * answers 400 naming each header; headers the DTO doesn't declare pass through.
 */
export const DeviceHeaders = createParamDecorator((dto: ClassConstructor<object>, context: ExecutionContext) => {
  const { headers } = context.switchToHttp().getRequest<Request>()
  const errors = validateSync(plainToInstance(dto, headers))
  if (errors.length > 0)
    throw new BadRequestException(errors.map(toMessage))
  return headers
})
