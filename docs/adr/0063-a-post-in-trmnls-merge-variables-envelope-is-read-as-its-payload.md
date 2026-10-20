# A POST in TRMNL's merge_variables envelope is read as its payload

TRMNL's webhook API takes `{"merge_variables": {...}}`, with `merge_strategy`, `deep_merge` and `stream_limit` beside it, and `merge_variables` also as JSON text (trmnlp's `WebhookPayload`). Every webhook Recipe's instructions, every script and every automation written for TRMNL send that envelope; a Recipe in the gallery documents that it "reads only what was sent ({"merge_variables": {"payment": {...}}})". Kuroshiro stored the whole body (ADR-0004), so a template written for TRMNL read `merge_variables.payment` where it expected `payment`, and a user following the Recipe's own instructions saw an empty Screen.

**A POST whose body is an object with a `merge_variables` key and no key TRMNL's envelope does not have is read as its `merge_variables`, parsed when sent as text; any other body is the payload itself.** The Merge Strategy stays the Plugin's, as ADR-0004 decided: `merge_strategy`, `deep_merge` and `stream_limit` in the envelope are ignored, not refused, so a script written for TRMNL runs unchanged and the strategy the admin fixed on the Plugin still governs.

Considered and rejected:

- **Honouring `merge_strategy` from the envelope.** ADR-0004's reason stands: a caller holding the Webhook Token could flip a Plugin's history to a replace.
- **Refusing an envelope that names a strategy other than the Plugin's.** A Recipe's script picks what TRMNL needs; the admin picked the Plugin's Merge Strategy knowing the Recipe, and a 422 on every POST would be a worse surprise than a strategy the admin chose.
- **Unwrapping any body that has a `merge_variables` key.** A payload of the admin's own could carry that key beside others; only the envelope's exact shape is TRMNL's.

## Consequences

- The Webhook URL row says so: "POST a JSON object or array here, on its own or inside TRMNL's merge_variables."
- `GET` on the Webhook URL still answers the stored payload bare, never re-wrapped.
