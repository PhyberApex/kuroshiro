import type { INestApplication, ModuleMetadata } from '@nestjs/common'
import type { AddressInfo } from 'node:net'
import { Test } from '@nestjs/testing'
import { registerErrorEnvelope } from '../errors/register-error-envelope.js'

export interface HttpTestApp {
  app: INestApplication
  request: (path: string, init?: RequestInit) => Promise<Response>
  postJson: (path: string, body: unknown, init?: RequestInit) => Promise<Response>
}

/**
 * Boots the given controllers behind the same global pipe, filter and prefix
 * as `main.ts` and serves them on a free port, so a spec can assert on what
 * actually goes over the wire.
 */
export async function createHttpTestApp(metadata: ModuleMetadata): Promise<HttpTestApp> {
  const moduleRef = await Test.createTestingModule(metadata).compile()
  const app = moduleRef.createNestApplication({ logger: false })
  app.setGlobalPrefix('api', { exclude: ['metrics'] })
  registerErrorEnvelope(app)
  await app.listen(0)
  const { port } = app.getHttpServer().address() as AddressInfo
  const request = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init)
  const postJson = (path: string, body: unknown, init: RequestInit = {}) => request(path, {
    method: 'POST',
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
    body: JSON.stringify(body),
  })
  return { app, request, postJson }
}
