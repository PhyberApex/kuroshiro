import type { NestExpressApplication } from '@nestjs/platform-express'
import process from 'node:process'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { AppModule } from './app.module.js'
import config, { unknownEnvVarWarnings } from './config/config.js'
import { registerErrorEnvelope } from './errors/register-error-envelope.js'
import { LoggingInterceptor } from './interceptors/logging.interceptor.js'
import { ingressBasePathMiddleware } from './middleware/ingress-base-path.middleware.js'
import { registerBodyParsers } from './uploads/register-body-parsers.js'
import { resolveAppPath } from './utils/pathHelper.js'
import 'reflect-metadata'

async function bootstrap() {
  const logger = new Logger('bootstrap')
  unknownEnvVarWarnings(process.env).forEach(warning => logger.warn(warning))
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })
  registerBodyParsers(app)
  app.use(ingressBasePathMiddleware(resolveAppPath('public')))
  const dataSource = app.get(DataSource)
  const pending = dataSource.migrations
  if (pending.length === 0) {
    logger.error('[Migrations] No migration files found (check dist/src/migrations in image)')
  }
  const run = await dataSource.runMigrations()
  if (run.length > 0) {
    logger.log(`[Migrations] Ran ${run.length} migration(s): ${run.map(m => m.name).join(', ')}`)
  }
  else {
    logger.log(`[Migrations] No migrations to be run`)
  }
  app.setGlobalPrefix('api', { exclude: ['metrics'] })
  registerErrorEnvelope(app)
  app.useGlobalInterceptors(new LoggingInterceptor())
  await app.listen(config().port)
}
bootstrap()
