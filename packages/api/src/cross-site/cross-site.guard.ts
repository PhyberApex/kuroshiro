import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common'
import type { Request } from 'express'
import { HttpStatus } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiException } from '../errors/api.exception.js'
import { OUTSIDE_ADMIN_API } from '../errors/outside-admin-api.decorator.js'

const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** The `Sec-Fetch-Site` values a browser sends for a request of the page's own origin, or one the user started. */
const OWN_SITE = new Set(['same-origin', 'none'])

function firstHeader(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return first?.split(',')[0]?.trim() || undefined
}

function hostOf(origin: string): string | undefined {
  try {
    return new URL(origin).host
  }
  catch {
    return undefined
  }
}

/**
 * Whether a browser sent this request on behalf of a page of another origin.
 *
 * `Sec-Fetch-Site` decides where the browser sends it. Without it, an `Origin` has to name
 * the host the request was sent to: the `Host`, or the `X-Forwarded-Host` a reverse proxy
 * set (a page of another site cannot set that header without a preflight, which is
 * refused). The scheme is not compared, since a proxy that ends TLS forwards plain HTTP.
 * `Origin: null` names no host and is refused. No `Origin` at all is curl or a script.
 */
function isCrossSite(request: Pick<Request, 'headers'>): boolean {
  const fetchSite = firstHeader(request.headers['sec-fetch-site'])
  if (fetchSite !== undefined)
    return !OWN_SITE.has(fetchSite)
  const origin = firstHeader(request.headers.origin)
  if (origin === undefined)
    return false
  const originHost = hostOf(origin)
  const ownHosts = [firstHeader(request.headers['x-forwarded-host']), firstHeader(request.headers.host)]
  return originHost === undefined || !ownHosts.includes(originHost)
}

/**
 * Refuses a state-changing request of the admin API that another site's page sent through
 * the admin's browser (issue #1742). The admin API has no authentication, so this is what
 * keeps a website, or a Recipe preview's sandboxed frame, from importing an archive.
 * Reads pass, and so do the routes marked `OutsideAdminApi`, whose callers are not browsers.
 */
export class CrossSiteGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    if (READS.has(request.method))
      return true
    if (this.reflector.getAllAndOverride<boolean>(OUTSIDE_ADMIN_API, [context.getHandler(), context.getClass()]))
      return true
    if (isCrossSite(request))
      throw new ApiException(HttpStatus.FORBIDDEN, 'cross-site-request', 'A state-changing request has to come from the admin UI\'s own origin.')
    return true
  }
}

export function registerCrossSiteRefusal(app: INestApplication): void {
  app.useGlobalGuards(new CrossSiteGuard(app.get(Reflector)))
}
