# Alerts are decided by a periodic Sweep and delivered via an Apprise sidecar

Grilling issue #1006 (a generic alerting system, starting with low-battery Devices) settled two shape decisions that a reader of the code might otherwise "fix".

**Alerts are decided only by the Alert Sweep, never inline in a request path.** The obvious place to check "is this battery low?" is the `/display` poll that writes `batteryVoltage` — but the system is meant to be generic, and the second v1 Rule (Device offline) is defined by the *absence* of a poll, which no request handler can observe. One cron-driven Sweep (every 5 minutes plus once on bootstrap, node-cron like the firmware sync) evaluates every Rule against persisted state, so every Rule — present and future — shares one evaluation path, one dedup model (at most one active Alert per Rule per subject) and one retry model (an Alert whose Notification failed is re-announced by the next Sweep). The Sweep runs and persists Alerts even when no Apprise endpoint is configured, so enabling delivery later doesn't burst-notify conditions that were already true.

**Delivery goes through the official `apprise-api` sidecar over HTTP, not a bundled Apprise.** Apprise is a Python library and the Kuroshiro image is `node:24-alpine` + chromium. Bundling it (Python runtime + subprocess) would grow every self-hoster's image for an opt-in feature; a native TypeScript channel set would forfeit Apprise's channel catalogue, which is the whole reason it was requested. The sidecar keeps the image untouched, keeps channel secrets (bot tokens, SMTP passwords) in the sidecar's own config key rather than Kuroshiro's environment, and is a one-block addition to `docker-compose.yml`. Kuroshiro only knows a base URL and a config key name, and POSTs `title`/`body`/`type` to `/notify/{key}`.

## Consequences

- Adding an Alert Rule means adding an evaluator the Sweep calls plus a `kind` value — never touching a controller.
- Notification latency is bounded by the Sweep interval, not by when the condition became true. Accepted: e-ink Devices poll on minute-scale cadences anyway.
- Anyone wanting alerting must run a second container. Documented in the README alongside the `KUROSHIRO_APPRISE_*` variables.

_Addendum (#1270):_ the 5-minute interval above is this ADR's default, not a fixed constant — `KUROSHIRO_ALERT_SWEEP_CRON` overrides it (validated, falls back to the default). Added so the real-API CI journey that waits on a Sweep can run it every few seconds instead of waiting on the clock; no operator needs to touch it.
