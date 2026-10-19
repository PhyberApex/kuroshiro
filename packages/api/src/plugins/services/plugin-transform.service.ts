import { Injectable, Logger } from '@nestjs/common'
import { VM } from 'vm2'
import { getErrorMessage } from '../../utils/getErrorMessage.js'

const DEFAULT_TIMEOUT_MS = 5000

export interface TransformOptions {
  /** How long the code may take, synchronously and awaiting, before the transform fails. */
  timeoutMs?: number
  /** The `fetch` the code may call, guarded by the caller; without one the code has no way to the network. */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
}

/**
 * The function a transform exports, found as TRMNL's serverless runtime finds it (ADR-0051): `run`, declared or
 * exported as `module.exports = { run }` / `exports.run`, then `module.exports` itself, then a declared `transform`.
 * Without one the input passes through unchanged.
 */
const PICK_TRANSFORM = `
  (() => {
    const exported = module.exports
    const candidates = [
      typeof run === 'function' ? run : undefined,
      exported && typeof exported.run === 'function' ? exported.run : undefined,
      typeof exported === 'function' ? exported : undefined,
      typeof transform === 'function' ? transform : undefined,
    ]
    const picked = candidates.find(candidate => candidate !== undefined)
    return picked ? picked(input) : input
  })()
`

@Injectable()
export class PluginTransformService {
  private readonly logger = new Logger(PluginTransformService.name)

  /**
   * Runs a transform in a sandbox on its input, the fetched data laid over the template context, and answers what the
   * transform returns, awaited when it is a promise. The sandbox has no `require` and no file system, and only the
   * `fetch` it is handed (ADR-0052).
   */
  async transform(transformJs: string, input: unknown, { timeoutMs = DEFAULT_TIMEOUT_MS, fetch }: TransformOptions = {}): Promise<unknown> {
    try {
      const moduleObj = { exports: {} }
      const vm = new VM({
        timeout: timeoutMs,
        sandbox: {
          input,
          data: input,
          module: moduleObj,
          exports: moduleObj.exports,
          console: {
            log: (...args: unknown[]) => this.logger.debug(`[Transform] ${args.join(' ')}`),
          },
          ...(fetch && { fetch }),
        },
      })

      const result = await withinTimeout(vm.run(`${transformJs}\n;${PICK_TRANSFORM}`), timeoutMs)
      this.logger.debug(`Transform executed successfully`)
      return result
    }
    catch (error) {
      this.logger.error(`Transform execution failed: ${getErrorMessage(error)}`)
      throw error
    }
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

async function withinTimeout(result: unknown, timeoutMs: number): Promise<unknown> {
  if (!(result instanceof Promise || isThenable(result)))
    return result

  let timer: NodeJS.Timeout | undefined
  const tooLate = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`The transform did not finish within ${timeoutMs} ms.`)), timeoutMs)
  })
  try {
    return await Promise.race([result, tooLate])
  }
  finally {
    clearTimeout(timer)
  }
}
