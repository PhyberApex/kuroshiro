# Fallow: dead code, duplication, complexity

[fallow](https://github.com/fallow-rs/fallow) scans both workspaces for unused files/exports/dependencies, import cycles, copy-paste duplication, and complexity hotspots. Config lives in `.fallowrc.jsonc`; it runs in CI as part of the `Checks` workflow.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm fallow` | Full local report (dead code + dupes + health), no gating |
| `pnpm fallow:ci` | What CI runs: each analysis compared against its baseline, fails on any **new** finding |
| `pnpm fallow:baseline` | Re-saves the three baselines in `.fallow-baselines/` from the current tree |
| `npx fallow dead-code --trace <file>:<export>` | Explain why an export is (un)used before deleting it |
| `npx fallow explain <issue-type>` | Explain a finding category |

## Baselines

`.fallow-baselines/{dead-code,dupes,health}.json` record findings that existed when fallow was introduced. Each one is tracked as a GitHub issue labelled `fallow`. CI only fails on findings that are not in the baseline, so the gate is "don't make it worse".

Rules for touching the baselines:

- **Fixing a baselined finding**: run `pnpm fallow:baseline` in the same PR so the entry disappears. `pnpm fallow:ci` must still pass.
- **Never** add a new finding to a baseline to get CI green. Fix it, or if it's a genuine false positive, handle it in `.fallowrc.jsonc` (`ignoreDependencies`, `overrides`, `duplicates.ignore`, `health.ignore`) or with an inline `// fallow-ignore-next-line <issue-type> -- <reason>` and say why in the PR.
- If a refactor moves a baselined finding (e.g. renames a function that is still too complex), re-save the baseline rather than suppressing it.

## Known false positives already handled in `.fallowrc.jsonc`

- `pg` (TypeORM loads the driver reflectively) and `jiti` (ESLint loads `packages/ui/eslint.config.ts` through it) are in `ignoreDependencies`.
- `packages/api/src/devices/display.ts` and `displayScreen.ts` are wire-format classes for the TRMNL firmware; `unused-class-members` is off for them.
- Migrations and the generated TRMNL snapshot are excluded from duplication and health scoring.
