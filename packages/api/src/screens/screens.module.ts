import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from 'src/devices/devices.entity'
import { ScreensController } from 'src/screens/screens.controller'
import { Screen } from 'src/screens/screens.entity'
import { ScreensService } from 'src/screens/screens.service'

@Module({
  imports: [TypeOrmModule.forFeature([Screen, Device]), ConfigModule],
  controllers: [ScreensController],
  providers: [ScreensService],
})
export class ScreensModule {}
