import type { INestApplication } from '@nestjs/common'
import { ApiExceptionFilter } from './api-exception.filter.js'
import { ApiValidationPipe } from './api-validation.pipe.js'

export function registerErrorEnvelope(app: INestApplication): void {
  app.useGlobalPipes(new ApiValidationPipe())
  app.useGlobalFilters(new ApiExceptionFilter())
}
