import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { Repository } from 'typeorm'
import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Plugin as PluginEntity } from '../entities/plugin.entity.js'

export interface WebhookRequest extends Request<{ token: string }> {
  plugin: Plugin
}

@Injectable()
export class WebhookPluginGuard implements CanActivate {
  constructor(
    @InjectRepository(PluginEntity)
    private readonly pluginRepository: Repository<PluginEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookRequest>()
    const token = request.params?.token

    if (!token) {
      throw new UnauthorizedException('Invalid webhook token')
    }

    const plugin = await this.pluginRepository.findOne({
      where: { webhookToken: token, kind: 'Webhook' },
      relations: { templates: true },
    })

    if (!plugin) {
      throw new UnauthorizedException('Invalid webhook token')
    }

    request.plugin = plugin
    return true
  }
}
