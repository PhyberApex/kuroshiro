import type { ValidationArguments, ValidationOptions, ValidatorConstraintInterface } from 'class-validator'
import type { JsonObject } from '../../utils/json.js'
import { IsObject, IsOptional, registerDecorator, ValidatorConstraint } from 'class-validator'
import { isPlainObject } from '../../utils/json.js'

function isObjectArray(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.every(isPlainObject)
}

@ValidatorConstraint({ name: 'logEnvelope' })
class LogEnvelopeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateLogDto
    if (dto.logs !== undefined)
      return isObjectArray(dto.logs)
    if (dto.log !== undefined)
      return isPlainObject(dto.log) && isObjectArray((dto.log as JsonObject).logs_array)
    return false
  }

  defaultMessage(): string {
    return 'Body must be either { logs: [...] } or { log: { logs_array: [...] } }, with each entry a JSON object'
  }
}

function ValidLogEnvelope(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: LogEnvelopeConstraint,
    })
  }
}

export class CreateLogDto {
  @ValidLogEnvelope()
  logs?: JsonObject[]

  @IsOptional()
  @IsObject()
  log?: {
    logs_array: JsonObject[]
  }
}
