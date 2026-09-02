import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { AppModule } from './app.module.js'
import config from './config/config.js'
import { LoggingInterceptor } from './interceptors/logging.interceptor.js'
import { ingressBasePathMiddleware } from './middleware/ingress-base-path.middleware.js'
import { resolveAppPath } from './utils/pathHelper.js'
import 'reflect-metadata'

async function bootstrap() {
  const logger = new Logger('bootstrap')
  const app = await NestFactory.create(AppModule)
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
  app.setGlobalPrefix('api')
  app.useGlobalInterceptors(new LoggingInterceptor())
  await app.listen(config().port)
}
bootstrap()
