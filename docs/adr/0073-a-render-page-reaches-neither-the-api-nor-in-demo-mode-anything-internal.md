# A render page reaches neither the API nor, in demo mode, anything internal

The shared render browser (ADR-0044) was launched with `--disable-web-security`, and Template markup runs in it with JavaScript on. With the same-origin policy off, a script in a Recipe's template, which is third-party code (ADR-0072), could read `http://localhost:3000/api/config/export` (every Device API key and password Field Value in plaintext) on every scheduled render, and a demo visitor posting HTML to `/api/device-preview` could read cloud metadata or a LAN host and get it back drawn into the PNG. The demo-mode guard of ADR-0052 covered Data Source fetches only. Issue #1741.

- **Web security is on.** The flag goes. It came in with the first render code and nothing in the repository's history says why. The TRMNL framework's CSS, JS and fonts on trmnl.com answer `Access-Control-Allow-Origin: *`, so they still load.
- **Every render page's requests are checked before they leave the browser.** `withSharedPage` turns on request interception, which leaves the HTTP cache on, so renders still share the framework assets. A refused request fails as a network error would. Each request is checked, a document an `<iframe>` loads too.
- **Refused on every Instance:** anything but `http:`, `https:` and the browser's own `data:`, `blob:` and `about:`; `localhost`, `*.localhost` and any name that resolves to loopback or `0.0.0.0`; the API's port on one of the host's own addresses; and the host and port of `KUROSHIRO_API_URL`, which devices use to reach the API and may lead back to it through a proxy.
- **Refused in demo mode as well:** every host the Data Source guard refuses, by name as written and by every address it resolves to, and any name that does not resolve.
- **In demo mode the guarded fetch makes the request.** A request the check lets through is made by `fetchPublic` and the page is answered with its response, so Chromium never connects itself. `fetchPublic` checks the address it connects to and each redirect. A name that answers a public address to the check and a private one to the connection (DNS rebinding) is refused, as it is for a Data Source.
- **No window opens.** Chromium's popup blocker stays on (Puppeteer turns it off by default). A window a script opens would be a page of its own, and no guard would watch its requests.

## Considered and rejected

- **Refusing private addresses on a self-hosted Instance too.** A self-hosted Recipe may read a Home Assistant or another service on the LAN from client-side JS. The admin chose to run it and owns that network. The API, which holds the secrets, is refused.
- **Answering every request through `fetchPublic` on a self-hosted Instance too.** It would bypass the shared HTTP cache for the framework assets (ADR-0044) on every render. Outside demo mode, the threat is the API, and loopback is refused by name and by address.

## Consequences

- Client-side JS in a template that reads another origin needs that origin to answer CORS, as it would in any browser. A Recipe relying on the old flag to read an API without CORS headers now gets a network error; its transform or Data Source can fetch the data instead.
- Outside demo mode the check resolves a name, then Chromium resolves it again to connect. A name that answers a public address to the check and loopback to Chromium could still reach the API. Only someone who controls that name's DNS can do it, from a Recipe the admin imported.
- In demo mode the framework assets are fetched on every render, as a fulfilled response is not cached.
- The API is refused at the addresses it can be known by: loopback, its port on the host's own addresses, and `KUROSHIRO_API_URL`. If the API is published on a Docker host's gateway or LAN address under another port, or behind a proxy under another name, it can still be reached there on a self-hosted Instance.
- WebSocket connections bypass request interception. The API serves none.
