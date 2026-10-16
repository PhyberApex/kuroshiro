# Every render draws in one shared, long-lived Chromium

Each call of `renderHtmlToPng` (Screen and Mashup `/display`, Fallback Screens, the device preview) used to launch a Chromium and close it again. That is seconds of start-up per render on a small self-hosted machine and no shared cache for the pinned framework CSS/JS. ADR-0040 left a long-lived browser as its own decision; issue #1465 makes it.

- **One browser per Instance, launched lazily.** The first render launches it; it stays open while the Instance runs and is closed in `OnModuleDestroy`, as the Plugin scheduler closes its timers.
- **A dead browser is replaced.** If it has disconnected or crashed, the next render launches a fresh one; a failed launch is retried by the next render.
- **A render is a page in the default context.** Each render opens a new page and closes it when it finishes, whether it succeeds, returns early on a Render Signal (ADR-0031) or throws. The default context keeps the pinned framework assets in one cache.
- **At most 4 pages draw at once.** Further renders wait in a queue. The limit is fixed, not configuration.
- **Unchanged.** Launch args, `PUPPETEER_EXECUTABLE_PATH` in Docker, viewport, screenshot and conversion, and the device preview's own one-at-a-time guard (ADR-0040).

## Considered and rejected

- **A browser context per render.** It would isolate renders but give each its own cache, undoing the point of sharing the framework assets.
- **A configurable pool size.** A fixed 4 bounds memory on a small machine without a new setting to document.

## Consequences

- Renders no longer isolate from each other beyond the page: a Template that crashes the renderer process can fail concurrent renders, which then retry on the relaunched browser the next time.
- Scripts that render outside Nest must call `closeSharedBrowser()` before exiting.
