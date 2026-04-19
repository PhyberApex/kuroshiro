import { Injectable, Logger } from '@nestjs/common'
import { VM } from 'vm2'

@Injectable()
export class PluginTransformService {
  private readonly logger = new Logger(PluginTransformService.name)

  /**
   * Execute transform.js on fetched data
   * Runs in a sandboxed VM to prevent malicious code execution
   */
  transform(transformJs: string, rawData: any): any {
    try {
      // Provide module and exports objects for Terminus compatibility
      const moduleObj = { exports: {} }

      // Create sandboxed VM with limited access
      const vm = new VM({
        timeout: 5000, // 5 second timeout
        sandbox: {
          data: rawData,
          module: moduleObj,
          exports: moduleObj.exports,
          console: {
            log: (...args: any[]) => this.logger.debug(`[Transform] ${args.join(' ')}`),
          },
        },
      })

      // Terminus transform.js exports a function via module.exports
      const transformCode = `
        ${transformJs}

        // Call the exported transform function
        if (typeof module.exports === 'function') {
          module.exports(data);
        } else if (typeof transform === 'function') {
          transform(data);
        } else {
          data; // Return data unchanged if no transform function found
        }
      `

      const result = vm.run(transformCode)
      this.logger.debug(`Transform executed successfully`)
      return result
    }
    catch (error) {
      this.logger.error(`Transform execution failed: ${error.message}`)
      this.logger.warn('Returning raw data without transformation')
      return rawData
    }
  }
}
