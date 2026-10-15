# Standard Liquid filters follow Ruby Liquid's semantics

Issue #1443: the Countdown recipe rendered `.178564814` because liquidjs's `divided_by` does float division where Ruby Liquid (which the TRMNL server runs) does integer division on two integers. Recipes are imported as-is (ADR-0010), so the engine has to answer like Ruby wherever a standard filter is involved.

- **Standard filters follow Ruby Liquid; Kuroshiro corrects liquidjs where they differ.** The next divergence is fixed the same way and added to the table-driven spec in `packages/shared/src/__test__/liquid.spec.ts`.
- **Kuroshiro does not shadow a builtin that already matches.** `round` and `url_encode` overrides were dropped; the builtins return a number (`round`) and use `+` for spaces. `url_decode` is corrected rather than dropped, since the builtin throws on a malformed `%`; it now answers the input unchanged. `{{ 3 | round: 2 }}` now prints `3` (Ruby `3.0`), accepted as closer than the old padded string.
- **Corrections are registered apart from `filters`** (the `corrections` map in `liquid.ts`), so `KUROSHIRO_FILTERS`, which the editor marks "Kuroshiro", lists only filters Kuroshiro adds.
- **`divided_by` floors when both operands are integers.** Strings are coerced as Ruby does (`'10'` is an integer, `'3.0'` a float). JavaScript cannot tell the literal `3.0` from `3`, so the filter reads the divisor's source text from its token; a float held in a variable is still told apart only by a fractional part. Division by zero keeps answering `Infinity`.
- **Kuroshiro's own string and date filters render nothing for input they cannot use** (`nil`, numbers, unparsable dates), as Ruby's string filters treat `nil`, instead of throwing or printing `Invalid Date`.
