# AGENTS.md

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`PhyberApex/kuroshiro`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

Code that is byte-identical in API and UI lives in `packages/shared`; see ADR-0020 for what does and doesn't belong there.

### Fallow (dead code, duplication, complexity)

`pnpm fallow:ci` runs in CI against committed baselines; fixing a baselined finding means re-running `pnpm fallow:baseline` in the same PR. See `docs/agents/fallow.md`.
