import type { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'
import { json, urlencoded } from 'express'
import { uploadTooLarge } from './limited-file-interceptor.js'
import { JSON_BODY_BYTES, UPLOAD_LIMITS } from './upload-limits.js'

const WEBHOOK_PATH = /^\/api\/webhook\//

function webhookJson(req: Request, res: Response, next: NextFunction): void {
  json({ limit: UPLOAD_LIMITS.webhookBodyBytes })(req, res, (error?: unknown) => {
    const tooLarge = (error as { type?: unknown } | undefined)?.type === 'entity.too.large'
    next(tooLarge ? uploadTooLarge(UPLOAD_LIMITS.webhookBodyBytes) : error)
  })
}

/**
 * Replaces Nest's default body parsers, which can't give one route its own
 * limit. Needs the app created with `bodyParser: false`.
 */
export function registerBodyParsers(app: NestExpressApplication): void {
  const regularJson = json({ limit: JSON_BODY_BYTES })
  app.use((req: Request, res: Response, next: NextFunction) =>
    WEBHOOK_PATH.test(req.path) ? webhookJson(req, res, next) : regularJson(req, res, next))
  app.use(urlencoded({ extended: true }))
}
