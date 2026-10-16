# A Template is TRMNL's Liquid: Ruby semantics plus TRMNL's custom filters

Recipes are imported as-is (ADR-0010) and promised to render here as they do on trmnl.com, but Kuroshiro's engine is liquidjs, not the Ruby Liquid the TRMNL server runs. Issue #1443 found three standard filters answering differently (`divided_by` dividing as floats where Ruby divides integers; Kuroshiro's own `round`, `url_encode` and `url_decode` overrides shadowing builtins that already matched Ruby), and #1444 found fourteen TRMNL custom filters missing outright, each of which liquidjs silently passes through unchanged. Grilled with the maintainer on 2026-10-15, the decision is that a Template speaks **TRMNL's Liquid dialect**, defined as Ruby Liquid's semantics for the standard filters plus the custom filters of TRMNL's open-source `trmnl-liquid` gem, and that Kuroshiro corrects or adds whatever liquidjs lacks to get there.

## The reference is the gem, not the help article

TRMNL's filter layer is open source and MIT-licensed (`github.com/usetrmnl/trmnl-liquid`, read at v0.8.3, wrapping Ruby `liquid` 5). Where TRMNL's help article and the gem disagree, **the gem wins**, because it is what trmnl.com runs. Two such disagreements were found during the grilling and are decided the gem's way: `number_to_currency` with a locale argument still groups thousands (`1,234.57 kr`, `£1,234.57`; the article shows them ungrouped), and `append_random` is not memoised at all (the input plus two random hex bytes, fresh on every call; the article's "stable within the layout" comes from `{% assign %}` capturing it once). Tables ported from the gem or its `trmnl-i18n` companion keep their copyright notice.

## Standard filters follow Ruby Liquid

Kuroshiro corrects liquidjs where it differs from Ruby and does not shadow a builtin that already matches. `divided_by` floors when both operands are integers after Liquid's usual string coercion. The `round` and `url_encode` overrides go, since the builtins already answer as Ruby does; `url_decode` is kept only so a malformed `%` renders the input instead of throwing. Kuroshiro's own string and date filters (`truncate_words`, `titleize`, `date_short`, `date_long`, `time_short`) render nothing for `nil`, numbers or unparsable dates, as Ruby's string filters treat `nil`. A correction is registered apart from the filters the editor marks as additions, so the completion never labels a standard filter name as Kuroshiro's. The next divergence found is fixed the same way and added to the table-driven spec in `packages/shared`.

`divided_by` coerces strings as Ruby does (`'10'` is an integer, `'3.0'` a float). JavaScript cannot tell the literal `3.0` from `3`, so the filter reads the divisor's source text from its token; a float held in a variable is told apart only by a fractional part. Division by zero keeps answering `Infinity`. The correction lives in the `corrections` map in `liquid.ts`.

## TRMNL's custom filters

Every filter the gem registers exists in `packages/shared` under TRMNL's name, argument order and output: `parse_json`, `find_by`, `number_to_currency`, `number_with_delimiter` with its delimiter and separator arguments, `pluralize` including its `plural:` keyword, `days_ago`, `ordinalize`, `append_random`, `random_number`, `l_date`, `l_word`, `map_to_i`, `markdown_to_html` and `qr_code`, beside the `json`, `sample`, `where_exp` and `strip_html` already there. The gem's `{% template %}` block tag and `l_date`'s symbolic format keys are not adopted.

Three places deliberately leave the gem:

- **`group_by` keeps liquidjs's list-of-groups shape** (`[{name, items}]`) rather than Ruby's hash keyed by value. Ruby's `g.first`/`g[0]` idiom has no clean liquidjs equivalent without breaking the shape Templates may already use, so this is documented as the one known divergence instead of overridden.
- **`days_ago` with no zone argument renders in the Instance Time Zone**, the same zone `date` renders in, rather than the gem's UTC default, so the two never disagree by a day on one instance. An explicit IANA zone argument is honoured as upstream.
- **`l_word` for an unknown word or locale returns the input unchanged**, where the gem renders a "Translation missing" string. The table ported is the six flat words (`today`, `tomorrow`, `updated`, `activity`, `done`, `due`) across the 27 locales `trmnl-i18n` ships; the gem's dotted per-plugin keys belong to TRMNL-hosted plugins that are not importable Recipes and are dropped.

`number_to_currency` treats its first argument as a locale when it is one of those same 27 locales (plus `en-GB`, the example above), taking symbol and position from rails-i18n's data, and as a unit prefix otherwise, exactly the gem's rule. `random_number` ignores its input, treats one argument as `0..n`, sorts two arguments, is inclusive, and returns an integer. `parse_json` on invalid input is a render error, as upstream. `sample` keeps Kuroshiro's optional count, a superset of the gem's.

## Two runtime dependencies

`markdown_to_html` and `qr_code` cannot be hand-rolled sensibly, so `packages/shared` grows from one runtime dependency to three, under the rule ADR-0033 set for `liquidjs`: catalog-pinned, listed in both the shared and the API manifest, external to the API bundle, browser-safe with no Node built-ins. Markdown is `marked` with GFM switched off and no sanitiser, mirroring the gem's Redcarpet with zero extensions, so tables, fenced code and autolinks render as plain text here as they do on trmnl.com. The QR encoder is a dependency-free one (`uqr` was picked at grilling, to be confirmed against the gem's module-size and error-level arguments when implemented) drawing the gem's markup: one `<svg class="qr-code" shape-rendering="crispEdges">` with a `viewBox` when responsive and `width`/`height` when `"fixed"` is passed.

## Completion labels

The editor's completion keeps two lists: TRMNL's filters marked "TRMNL" and Kuroshiro's own inventions (`date_short`, `date_long`, `time_short`, `truncate_words`, `titleize`, `shuffle`, `yesno`) marked "Kuroshiro". The marker exists to say "this does not work on plain Liquid", and naming which dialect added it is strictly more useful than one label for both.

## Considered and rejected

- **The help article as the specification.** Rejected once the gem was read: the article's examples are hand-written and two of them are wrong. Following them would make Kuroshiro diverge from trmnl.com in the name of matching it.
- **Memoising `append_random` per render.** The original #1444 brief asked for it. Rejected because upstream does not, and memoising would make two calls on the same input collide where trmnl.com gives two suffixes.
- **Renaming `group_by` to TRMNL's hash shape, after hunting the Recipe catalog for users of it.** Rejected without the hunt: even a positive finding could not be served, since the hash idiom cannot be expressed in liquidjs without breaking the list shape.
- **`number_to_currency` recognising every rails-i18n locale.** Rejected for the 27 `trmnl-i18n` locales, which are the only values `trmnl.user.locale` can hold.
- **One ADR per issue.** Rejected: the Ruby-semantics rule and the custom filters are one decision seen from two sides. #1443 and #1444 both record their work here.

## Consequences

- A liquidjs upgrade may reintroduce a divergence; the table-driven spec of standard-filter outputs is the guard.
- `{{ 3 | round: 2 }}` prints `3` where Ruby prints `3.0`; accepted as closer than the padded string the old override produced.
- A Template that used liquidjs-only behaviour (float `divided_by`, `encodeURIComponent`-style `url_encode`) renders differently after #1443 lands. No such Template is known.
- A runtime dependency added to `packages/shared` must also be a dependency of `packages/api`, or the production image fails at `require` (ADR-0033). The browser build of a file importing only the shared liquid module must keep succeeding without Node polyfills.
- The two deliberate divergences from the gem (`days_ago`'s default zone, `l_word`'s fallback) and the one from TRMNL (`group_by`) are the complete list; anything else that differs from trmnl.com is a bug.
