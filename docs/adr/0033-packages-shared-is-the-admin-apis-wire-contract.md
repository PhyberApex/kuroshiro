# `packages/shared` is the admin API's wire contract

ADR-0020 kept `packages/shared` to code that was byte-identical in API and UI, and rejected making it the full wire contract "for now": `Device`, `Screen`, `DeviceModel` and `Palette` differ between entity (`Date`) and wire (`string`), and a serialize layer was more machinery than the duplication of the day justified. It named the condition for revisiting: the wire-type surface growing enough to be worth it. The admin UI rebuild (map #1074, decided in #1113 on the research of #1096) is that growth. Nine endpoints are added and 42 change, every read becomes a purpose-built shape instead of a raw entity, and the new UI's test fixtures have to be typed by the same shapes the API answers with. So the admin API's request and response types become hand-written plain interfaces in `packages/shared/src/api/`, one file per resource group, re-exported from the existing barrel. This supersedes the "Considered Options" rejection in ADR-0020; its packaging rules (source-only, one barrel, a `devDependency` inlined by tsup and Vite, `import type` only from entities and migrations) stand.

The API builds each response with a mapper function per resource (entity and derived facts in, read model out) and declares the shared type as the return type of every admin controller method. A controller never returns an entity. Request DTOs stay `class-validator` classes and `implements` their shared input type. Constants both sides validate against (refresh bounds, the MAC pattern, Mashup layouts, error codes) live beside the types. `packages/ui-next` imports with `import type` in its API client and its fixture builders; because every key of a read type is required and absence is `null`, a field added to a read type fails to compile in the builder until the builder sets it.

ADR-0020's rule, one definition used as-is by both sides, still holds: the API no longer keeps a second copy of a shape, it maps into the shared one. What goes is the restriction to shapes that happened to be identical already.

`packages/shared` also gains its first runtime dependency. The Plugin template editor renders its preview in the browser with the same Liquid configuration and filters the server uses, so that code moves to `packages/shared` and brings `liquidjs`. This is safe for the production image only because `packages/api` keeps `liquidjs` as its own dependency: the API bundle inlines `kuroshiro-shared` but leaves `node_modules` imports external, and `pnpm install --prod` reads only the API's manifest. Both packages take `liquidjs` from the workspace catalog so server and browser run one version.

## Considered Options

- **Generate types from an OpenAPI document** (`@nestjs/swagger` plus `openapi-typescript`). Rejected: Nest cannot see interface return types, so response classes would be written anyway, plus a generation step and wrapped generated names, for the same compile-time guarantee and an API description nobody has asked for.
- **The UI imports types from `packages/api/src`.** Rejected: the UI's compiler would load TypeORM and `class-validator`, and entities carry `Date` where the wire carries strings, the divergence ADR-0020 refused to paper over.
- **Runtime schemas (zod) in `packages/shared`.** Rejected for now: it replaces `class-validator` across every DTO, and its one advantage, validating answers at runtime, matters only for fixtures, which the types already reach.

## Consequences

- About fifteen mappers with tests, and each request shape described twice (the shared interface and the decorated DTO). `implements` catches a missing or mistyped property, not a decorator that disagrees with the type.
- The guarantee is compile-time only; an `as` cast in a controller defeats it.
- A runtime dependency added to `packages/shared` must also be a dependency of `packages/api`, or the production image fails at `require`.
- The old `packages/ui` keeps its hand-written types and is not migrated; it is deleted at parity.
