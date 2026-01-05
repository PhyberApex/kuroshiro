import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import config from './config/config'
import { LoggingInterceptor } from './interceptors/logging.interceptor'
import 'reflect-metadata'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.useGlobalInterceptors(new LoggingInterceptor())
  await app.listen(config().port)
}
bootstrap()
