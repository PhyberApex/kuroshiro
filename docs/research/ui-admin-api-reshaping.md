# Admin API reshaping for the new screens

Research for [#1096](https://github.com/PhyberApex/kuroshiro/issues/1096), part of the map [#1074](https://github.com/PhyberApex/kuroshiro/issues/1074).

- **Question:** Which admin API endpoints do the specced screens need added, changed or removed, and what is each one's new shape? Plus: where the admin API's response types live and how `packages/ui-next` imports them, and the open calls the specs left to this ticket.
- **Snapshot:** `origin/main` at `85868a1` (2026-10-02). The four specs read from the branch `docs/1095-ui-spec-template-editor` (`docs/ui/devices.md`, `plugins.md`, `instance.md`, `template-editor.md`, `README.md`). Issues read the same day.
- **Sources (all primary):** the controllers, DTOs, entities, services and migrations in `packages/api/src`; `packages/shared/src`; the old UI's API calls in `packages/ui/src` (only to say what breaks); `CONTEXT.md` and `docs/adr/`; issues #1096 (with its five comments), #1069, #1070, #1071, #1062, #1064, #1101, #1074.
- **Not run.** Nothing here was run against a database or a Device. Every "today" statement is read from code and cites `path:line`; every shape, name and rule is a recommendation unless it says otherwise. Section 6 lists what was inferred.

Paths are relative to the repo root. `api/` means `packages/api/src/`, `shared/` means `packages/shared/src/`, `ui/` means `packages/ui/src/`. A spec request is cited as `devices.md add 4` (the spec's "What this asks of the admin API" list, "To add", item 4), `plugins.md change 12`, `instance.md remove`, and so on.

## Summary

PLACEHOLDER-SUMMARY

## How to read the endpoint list

Each endpoint has an id (`D3`, `S2`, `P7`, …) that section 5 refers to, its verb and path, a verdict, what exists today, the spec requests it serves, the shapes as TypeScript sketches and the rules that are part of its contract. Verdicts:

| Verdict | Meaning |
|---|---|
| **add** | No endpoint does this today. |
| **change** | The endpoint exists; its path, request, response or behaviour changes. A moved path is a change, not a remove plus an add. |
| **remove** | The endpoint goes. |
| **keep** | Listed because a screen calls it; nothing changes beyond the cross-cutting conventions of section 2 (error envelope, shared response type). |

The type sketches follow section 2's conventions: every time is an ISO 8601 string, every absent value is `null` (never a missing key), derived fields sit beside stored ones without prefixes, and image addresses are root-relative paths the UI prefixes with its base path. The named types (`DeviceSummary`, `ScreenRead`, `ApiError`, …) are the ones section 3 puts in `packages/shared`.

The Device-facing endpoints are fixed by the map and are not in the list except where a change is internal bookkeeping that leaves their responses byte-for-byte as they are: `GET /api/setup`, `GET /api/display`, `GET /api/current_screen`, `POST /api/log`, `GET`/`POST /api/webhook/:token` (called by Webhook senders) and `GET /metrics`.
