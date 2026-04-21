import type { PluginVariable } from '../entities/plugin-variable.entity'
import process from 'node:process'
import { Injectable, Logger } from '@nestjs/common'

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

  resolveInObject(obj: Record<string, any>, variables: PluginVariable[]): Record<string, any> {
    const resolved: Record<string, any> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveVariables(value, variables)
      }
      else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveInObject(value, variables)
      }
      else {
        resolved[key] = value
      }
    }

    return resolved
  }
}
