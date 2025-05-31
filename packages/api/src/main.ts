import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import config from './config/config'
import 'reflect-metadata'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  await app.listen(config().port)
}
bootstrap()
