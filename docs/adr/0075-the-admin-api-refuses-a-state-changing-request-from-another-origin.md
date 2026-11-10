# The admin API refuses a state-changing request from another origin

The admin API has no authentication (`docs/ui/instance.md`), on the assumption that only the admin reaches it. But the admin's own browser carries requests in from pages of other origins, and a multipart or form `POST` is a CORS "simple" request that is sent with no preflight. Any website the admin visits could post a Configuration Archive to `/api/config/import`, without reading the answer. So could a Recipe's preview, whose sandboxed `srcdoc` frame has an opaque origin but resolves relative URLs against the admin page. The imported archive plants Plugins and overwrites the Instance Settings. Issue #1742.

- **A global guard refuses a `POST`, `PUT`, `PATCH` or `DELETE` from another origin** with `403` and the code `cross-site-request`. The guard runs before a route's interceptors, so an upload is never read.
- **`Sec-Fetch-Site` decides when the browser sends it.** `same-origin` and `none` (a request the user started) pass, and `same-site` and `cross-site` are refused. Every current browser sends it, so behind a proxy that rewrites the `Host` the UI still passes.
- **Without it, the `Origin` decides.** A request with no `Origin` is curl or a script, and passes. Otherwise the `Origin`'s host has to be the `Host` or the `X-Forwarded-Host`. A page of another origin cannot set `X-Forwarded-Host` without a preflight, which the API does not answer. The scheme is not compared, because a proxy that ends TLS forwards plain HTTP. `Origin: null` names no host and is refused.
- **A route marked `OutsideAdminApi` is not checked.** Its callers (a Device, a Webhook sender, a scraper) are not browsers, and a Webhook sender may well be a page of another origin. The one marker decides both the error body and the exemption, so a route cannot get one without the other.
- **The API reads no form-encoded body.** No route needed the global `urlencoded` parser, and a form is the body another site can post without a preflight.

## Considered and rejected

- **A CSRF token or a custom header the UI adds.** It would mean a token to serve, store and send on every write, and the guard above already refuses the requests a token would. The UI's own requests already carry `Sec-Fetch-Site: same-origin`.
- **A list of allowed hosts.** It would also stop DNS rebinding, but an Instance would have to be told the names it is reached by, which is a decision of its own.

## Consequences

- A page that rebinds a name in DNS to the Instance is same-origin to the browser, so it is not refused, and it can read the API as well. A list of allowed hosts would be a separate decision.
- A tool that posts to the admin API with a browser-like `Origin` of another host, or with `Sec-Fetch-Site: cross-site`, is refused. A script that sends neither is not.
- A Webhook sender's page in a browser can still post to `/api/webhook/*`. The Webhook Token is what guards it.
