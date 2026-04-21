import type { Response } from 'express'
import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { AssignPluginToDeviceDto } from './dto/assign-plugin-to-device.dto'
import { CreatePluginDto } from './dto/create-plugin.dto'
import { UpdatePluginDto } from './dto/update-plugin.dto'
import { PluginsService } from './plugins.service'
import { PluginExporterService } from './services/plugin-exporter.service'
import { PluginImporterService } from './services/plugin-importer.service'

@Controller('plugins')
export class PluginsController {
  constructor(
    private readonly pluginsService: PluginsService,
    private readonly importerService: PluginImporterService,
    private readonly exporterService: PluginExporterService,
  ) {}

  @Post('preview')
  async preview(@Body() previewData: { url: string, method: string, headers?: Record<string, string>, body?: any, template: string, transformJs?: string, fieldValues?: Record<string, string> }) {
    return this.pluginsService.preview(previewData.url, previewData.method, previewData.headers, previewData.body, previewData.template, previewData.transformJs, previewData.fieldValues)
  }

  @Get()
  async findAll() {
    return this.pluginsService.findAll()
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.pluginsService.findById(id)
  }

  @Get('device/:deviceId')
  async findByDevice(@Param('deviceId') deviceId: string) {
    return this.pluginsService.findByDevice(deviceId)
  }

  @Post()
  async create(@Body() createPluginDto: CreatePluginDto) {
    return this.pluginsService.create(createPluginDto)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updatePluginDto: UpdatePluginDto) {
    return this.pluginsService.update(id, updatePluginDto)
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const success = await this.pluginsService.remove(id)
    return { success }
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
          cb(null, `${file.fieldname}-${uniqueSuffix}${file.originalname}`)
        },
      }),
    }),
  )
  async importPlugin(@UploadedFile() file: Express.Multer.File, @Body('deviceId') deviceId?: string) {
    if (!file) {
      throw new Error('No file uploaded')
    }

    const parsedPlugin = await this.importerService.importFromFile(file.path)

    const createDto: CreatePluginDto = {
      ...parsedPlugin,
      isActive: false,
      order: 1,
    }

    const plugin = await this.pluginsService.create(createDto)

    // If deviceId provided, auto-assign to that device
    if (deviceId) {
      await this.pluginsService.assignToDevice(plugin.id, { deviceId, isActive: true, order: 0 })
    }

    // Return plugin with security warning if transform.js exists
    return {
      ...plugin,
      _hasTransform: !!parsedPlugin.dataSource?.transformJs,
    }
  }

  @Post('import-github')
  async importFromGithub(@Body() body: { githubUrl: string, deviceId?: string }) {
    if (!body.githubUrl) {
      throw new Error('GitHub URL is required')
    }

    const parsedPlugin = await this.importerService.importFromGithubUrl(body.githubUrl)

    const createDto: CreatePluginDto = {
      ...parsedPlugin,
      isActive: false,
      order: 1,
    }

    const plugin = await this.pluginsService.create(createDto)

    // If deviceId provided, auto-assign to that device
    if (body.deviceId) {
      await this.pluginsService.assignToDevice(plugin.id, { deviceId: body.deviceId, isActive: true, order: 0 })
    }

    // Return plugin with security warning if transform.js exists
    return {
      ...plugin,
      _hasTransform: !!parsedPlugin.dataSource?.transformJs,
    }
  }

  @Get(':id/export')
  async exportPlugin(@Param('id') id: string, @Res() res: Response) {
    const plugin = await this.pluginsService.findById(id)
    if (!plugin) {
      return res.status(404).json({ message: 'Plugin not found' })
    }

    const zipBuffer = await this.exporterService.exportToZip(plugin)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${plugin.name}.trmnlp.zip"`)
    res.send(zipBuffer)
  }

  @Post(':id/assign')
  async assignToDevice(@Param('id') id: string, @Body() assignData: AssignPluginToDeviceDto) {
    return this.pluginsService.assignToDevice(id, assignData)
  }

  @Delete(':id/unassign/:deviceId')
  async unassignFromDevice(@Param('id') id: string, @Param('deviceId') deviceId: string) {
    const success = await this.pluginsService.unassignFromDevice(id, deviceId)
    return { success }
  }

  @Patch('device-assignment/:devicePluginId')
  async updateDeviceAssignment(@Param('devicePluginId') devicePluginId: string, @Body() updates: any) {
    return this.pluginsService.updateDeviceAssignment(devicePluginId, updates)
  }
}
