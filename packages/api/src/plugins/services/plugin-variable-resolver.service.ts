import type { PluginVariable } from '../entities/plugin-variable.entity.js'
import process from 'node:process'
import { Injectable, Logger } from '@nestjs/common'
import { isPlainObject } from '../../utils/json.js'

@Injectable()
export class PluginVariableResolverService {
  private readonly logger = new Logger(PluginVariableResolverService.name)

  resolveVariables(text: string, variables: PluginVariable[]): string {
    if (!text || !variables || variables.length === 0) {
      return text
    }

    let resolved = text

    // Support both {{ VAR_NAME }} and ${VAR_NAME} syntax
    for (const variable of variables) {
      const patterns = [
        new RegExp(`\\{\\{\\s*${variable.key}\\s*\\}\\}`, 'g'),
        new RegExp(`\\$\\{${variable.key}\\}`, 'g'),
      ]

      for (const pattern of patterns) {
        resolved = resolved.replace(pattern, variable.value)
      }
    }

    // Also support environment variables
    resolved = resolved.replace(/\$\{([^}]+)\}/g, (match, envKey) => {
      const envValue = process.env[envKey]
      if (envValue !== undefined) {
        return envValue
      }
      return match // Keep original if not found
    })

    return resolved
  }

  resolveInObject<T extends Record<string, unknown>>(obj: T, variables: PluginVariable[]): T {
    const resolved: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = this.resolveValue(value, variables)
    }

    return resolved as T
  }

  private resolveValue(value: unknown, variables: PluginVariable[]): unknown {
    if (typeof value === 'string') {
      return this.resolveVariables(value, variables)
    }
    if (Array.isArray(value)) {
      return value.map(item => this.resolveValue(item, variables))
    }
    if (isPlainObject(value)) {
      return this.resolveInObject(value, variables)
    }
    return value
  }
}
