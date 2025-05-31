import { Body, Controller, Logger, Post, UsePipes, ValidationPipe } from '@nestjs/common'
import { CreateLogDto } from './dto/create-log.dto'

@Controller('log')
export class LogsController {
  private readonly logger = new Logger(LogsController.name)
  constructor() {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async consumeLog(@Body() body: CreateLogDto) {
    this.logger.log(`Got log ${JSON.stringify(body)}`)
  }
}
