# AGENTS.md

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`PhyberApex/kuroshiro`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

Code both API and UI need lives in `packages/shared`: the admin API's wire types (ADR-0033) and code that is identical on both sides (ADR-0020, which also sets how the package is built and imported).

### Admin API contract

Request and response types live in `packages/shared/src/api/`; the API maps entities into them with `to<ReadModel>` functions and a controller never returns an entity. See `docs/agents/api-contract.md`.

### Testing the admin UI

`packages/ui` is tested in real Chromium with the API faked by MSW, an axe gate, screenshot baselines from one pinned image and a suite against the real API. How to run each, how to regenerate baselines and what a primitive, a screen and a journey must ship with: `docs/agents/ui-testing.md`.

### Building a screen of the admin UI

A page of `packages/ui` stands on the shell, the router, the API client and the shared page patterns: how to add a route and a page, load data with its loading, empty and failed states, write and word a refusal, resolve an image path, show a time and guard unsaved changes is in `docs/agents/ui-screens.md`.

### Fallow (dead code, duplication, complexity)

`pnpm fallow:ci` runs in CI against committed baselines; fixing a baselined finding means re-running `pnpm fallow:baseline` in the same PR. See `docs/agents/fallow.md`.
