# Admin API contract

`packages/shared` is the admin API's wire contract (ADR-0033). The API answers in its types, and `packages/ui-next` types its API client and its fixture builders with the same ones. The packaging rules of ADR-0020 stand: source-only, one barrel, a `devDependency` inlined by tsup and Vite, and entities and migrations may only `import type` from it.

## Where the types live

`packages/shared/src/api/`, one file per resource group: `devices.ts`, `screens.ts`, `plugins.ts`, `alerts.ts`, `instance.ts`, `firmware.ts`, `device-models.ts`, `configuration.ts`, `maintenance.ts`, `errors.ts`. Create a file when its first type lands and add it to `packages/shared/src/index.ts`; there are no subpath exports, so everything is imported from `kuroshiro-shared`. Constants both sides validate against (bounds, patterns, layouts, error codes) sit beside the types.

## Shape rules for a read model

These bind every type written from now on. The types that were shared before ADR-0033 (`AlertSummary`, `FirmwareSyncResult` and the others moved in as they were) keep their shape until the slice that owns their endpoint reshapes them.

- **Every key is present; absent is `null`.** No optional keys, so a fixture builder has to decide every field.
- **Names** are `camelCase` and use the vocabulary of `CONTEXT.md`, renaming a stored column on the read where the two differ. Booleans read as statements (`isMirrored`, `filePresent`). A derived field sits beside stored ones with no marker and no `_` prefix.
- **Times end in `At`** and are ISO 8601 strings.
- **A related record is a reference**, `{ id, name }` plus what the screen needs, never the whole record.
- **No secret on a list read.** An API key or a Webhook Token appears only on the detail read whose screen reveals it; elsewhere a boolean says whether it is set.
- **An image is a root-relative path** with a cache-busting version (`/screens/devices/{deviceId}/{screenId}.png?v={ms}`), which the UI prefixes with its base path.

## In `packages/api`

- **One mapper per resource**, in the module that owns it, named `to<ReadModel>`: the entity and its derived facts in, the read model out, no I/O. The service loads the entity and the facts, the mapper shapes them. Each mapper has a unit test.
- **Helpers** for what every mapper repeats are in `src/utils/readModel.ts`: `toIsoString`, `toIsoStringOrNull`, `toImagePath`.
- **Every admin controller method declares its shared return type**, and never returns an entity. A handler that predates the convention gets its declared type in the PR that reshapes its endpoint.
- **A request DTO stays a `class-validator` class** and `implements` its shared input type. `implements` catches a missing or mistyped property, not a decorator that disagrees with the type.

The worked example is `GET` and `PATCH /api/settings`: `InstanceSettingsResponse` and `UpdateInstanceSettingsInput` in `packages/shared/src/api/instance.ts`, `toInstanceSettingsResponse` in `packages/api/src/settings/instance-settings.mapper.ts` with its spec, `SettingsController` typed against the response, and `UpdateInstanceSettingsDto implements UpdateInstanceSettingsInput`.

## The guard

`packages/api/src/__test__/controllers-answer-read-models.spec.ts` resolves the return type of every route handler with the TypeScript checker and fails when it carries an `@Entity` class, whether declared or inferred, directly or nested in a promise, an array, a union, a property or a subclass. Handlers that still answer an entity are listed in its `KNOWN_EXCEPTIONS`. The list has to match exactly: when a slice reshapes an endpoint, it removes that handler's entry in the same PR, and no entry may be added. It matches `@Entity` and the route decorators by their imported names, so an aliased import, like an `as` cast or an `any` return, defeats it.
