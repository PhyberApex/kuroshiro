# The Alerts admin surface is a pure read plus one Test Notification action

Triage of issue #1023 lifted the "no admin UI" cut from ADR-0023 and settled the shape of that UI. Each choice below picks the smaller option on purpose; every one of them can be widened additively.

**Resolved Alerts show as a fixed window, not pages.** The list returns every active Alert and the resolved Alerts of the last 7 days, capped at 50, newest first. Pagination would need page state, a total-count query and controls for a table that a retention job (#1027) will eventually keep small anyway. The window is a query parameter on the endpoint so a later switch does not change the response shape.

**The Test Notification goes through the real sender.** The operator's question is "would a real Alert reach me?", and only the production path answers it: the same config lookup, the same Apprise URL and key, the same timeout. A dedicated test path would only prove that the test path works. The action writes no `Alert` row and never touches the Sweep.

**The button lives on the Maintenance page's Alerts card.** Maintenance is already the operator's "is the system healthy" surface with sync and cleanup actions. An Instance Settings page (#1025) does not exist yet and must not gate this; moving one button later is trivial.

**The surface is read-only apart from that one action.** No acknowledge, dismiss, snooze or manual resolve. Any of those would need new columns and would change Sweep semantics, since a dismissed Alert must not simply reopen on the next Sweep. That is its own grilling, if it is ever wanted.

**Device Details shows one chip per active Alert, labelled with the Rule, not a count.** Only two Rules exist, so a bare count hides the one fact the operator wants. A chip per Alert also gives a future Rule (#1026) a place to land without redesign.

## Consequences

- `AlertKind` and the kind-to-label map live in `packages/shared` (ADR-0020) so the Sweep, the API entity and the UI cannot drift on what a kind is called.
- The list endpoint is the only reader of the `Alert` table besides the Sweep; retention (#1027) can prune freely without breaking the UI beyond shortening the resolved section.
