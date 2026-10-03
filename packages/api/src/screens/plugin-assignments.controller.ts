import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { AssignPluginToDeviceDto } from '../plugins/dto/assign-plugin-to-device.dto.js'
import { PluginAssignmentsService } from '../plugins/services/plugin-assignments.service.js'
import { ScreenReadsService } from './screen-reads.service.js'

/**
 * A Plugin Assignment is answered as the Screen it puts on the Device, which
 * is why these `plugins` routes are served from the Screens module.
 */
@Controller('plugins/:pluginId')
export class PluginAssignmentsController {
  constructor(private readonly assignments: PluginAssignmentsService, private readonly screenReads: ScreenReadsService) {}

  @Post('assign')
  async assign(@Param('pluginId') pluginId: string, @Body() body: AssignPluginToDeviceDto): Promise<ScreenRead> {
    return this.screenReads.forScreen(await this.assignments.assign(pluginId, body.deviceId))
  }

  @Delete('assignments/:deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassign(@Param('pluginId') pluginId: string, @Param('deviceId') deviceId: string): Promise<void> {
    await this.assignments.unassign(pluginId, deviceId)
  }
}
