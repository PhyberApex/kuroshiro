import type { NestExpressApplication } from '@nestjs/platform-express'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { AppModule } from './app.module.js'
import config, { logUnknownEnvVars } from './config/config.js'
import { migrationLogger } from './config/migration-logger.js'
import { registerErrorEnvelope } from './errors/register-error-envelope.js'
import { LoggingInterceptor } from './interceptors/logging.interceptor.js'
import { ingressBasePathMiddleware } from './middleware/ingress-base-path.middleware.js'
import { registerBodyParsers } from './uploads/register-body-parsers.js'
import { resolveAppPath } from './utils/pathHelper.js'
import 'reflect-metadata'

async function bootstrap() {
  logUnknownEnvVars()
  const logger = new Logger('bootstrap')
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })
  registerBodyParsers(app)
  app.use(ingressBasePathMiddleware(resolveAppPath('public')))
  const dataSource = app.get(DataSource)
  if (dataSource.migrations.length === 0) {
    logger.error('[Migrations] No migration files found (check dist/src/migrations in image)')
  }
  if (migrationLogger.ran.length > 0) {
    logger.log(`[Migrations] Ran ${migrationLogger.ran.length} migration(s): ${migrationLogger.ran.join(', ')}`)
  }
  else {
    logger.log(`[Migrations] No migrations to be run`)
  }
  app.setGlobalPrefix('api', { exclude: ['metrics', 'health'] })
  registerErrorEnvelope(app)
  app.useGlobalInterceptors(new LoggingInterceptor())
  // Lets SIGTERM run the modules' destroy hooks, which close the shared render browser rather than orphan it (ADR-0044).
  app.enableShutdownHooks()
  await app.listen(config().port)
}
bootstrap()
