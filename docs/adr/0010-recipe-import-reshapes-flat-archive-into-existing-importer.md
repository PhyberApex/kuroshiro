# Recipe import reshapes TRMNL's flat archive into the existing GitHub-importer's plugin shape

Issue #778 asks Kuroshiro to import TRMNL Recipes, the same catalog Terminus's Extension Gallery imports from. We downloaded and inspected a real archive (`trmnl.com/api/plugin_settings/:id/archive`) rather than assuming it matched `plugin-importer.service.ts`'s existing GitHub-repo import path. It doesn't: a Recipe archive is flat — `settings.yml` plus `*.liquid` files at the zip root, no `.trmnlp.yml` manifest, no `src/` prefix — whereas `importFromZip` requires both and throws if either is missing. `settings.yml` itself carries both manifest-level fields (`name`, `description`, `custom_fields`) and settings-level polling config (`polling_url`/`polling_verb`/`polling_headers`/`polling_body`, `refresh_interval`) in one file, which `buildParsedPlugin` already knows how to read across its manifest/settings fallback logic.

We add a thin adapter ahead of the existing zip-import path — reshape the flat archive's entries as if they lived under `src/`, synthesize the manifest fields `buildParsedPlugin` expects from `settings.yml` — rather than writing a second, parallel parser. The field-mapping work (Terminus-format fallbacks, `custom_fields` → `PluginField`, `transform.js` extraction) already lives in `buildParsedPlugin`; duplicating it in a Recipe-specific service would mean two places to keep in sync every time that mapping changes.

Two mapping decisions fall out of this:

- **Serverless-transform recipes are supported**, unlike Terminus (which rejects any archive containing a `transform` file — `terminus/app/aspects/extensions/importers/remote/transformer.rb`). Kuroshiro's importer already has first-class `transform.js` handling; excluding it here would be an arbitrary restriction with no implementation cost saved.
- **The `author_bio` custom field is forced `required: false`** on import. TRMNL ships it without an `optional: true` flag, so the existing `required: !field.optional` mapping would otherwise treat a read-only credit blurb as a field the admin must fill in before saving — this is the field that carries Recipe attribution, and forcing it optional is what makes it usable as informational text rather than a blocking required input.

Import accepts either a bare numeric Recipe id or a full `trmnl.com/recipes/...` URL, parsed down to the id the same way `importFromGithubUrl` already parses a GitHub URL down to a zip download URL.

## Consequences

- If TRMNL changes the archive's flat shape or adds new top-level `settings.yml` fields, only the adapter needs updating — `buildParsedPlugin` and its Terminus-format fallbacks are unaffected.
- Any future non-Recipe import source that shares this flat shape (e.g. a direct file upload) could reuse the same adapter instead of `importFromZip`'s manifest-required path.
