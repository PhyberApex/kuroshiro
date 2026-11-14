# A transform runs in a QuickJS sandbox whose web globals are its own

vm2 is the sandbox ADR-0051 chose, and ADR-0055 handed it the server's own `URL`, `TextEncoder`, `crypto`, `Headers`, `Request` and `Response` on the reasoning that "a `URL` from the host is as good as one from the realm". It is not. vm2 isolates with a Proxy membrane over the host's own heap, so every object lent in is a path back to it, and vm2 has a long record of escapes past that membrane; about ten critical ones were published 2026-10-05..07 alone (GHSA-pq68-rvw4-xp4r, GHSA-5h3f-q97h-ccvc). A transform is third-party code — ADR-0072 already says a Recipe imported from trmnl.com is one, and ten of the twenty-five Recipes on the first page of `trmnl.com/recipes.json` ship a `transform.js`, the largest 36 kB — so until the dependency is bumped, each new escape is code execution inside the API process, which holds the database credentials in its environment. A demo Instance adds an anonymous admin who may type a transform directly, but the Recipe gallery is the larger vector and it reaches every Instance (#1750).

**A transform runs in a QuickJS interpreter compiled to WebAssembly**, `quickjs-emscripten`'s release-asyncify build. It shares no heap with the host: values cross the boundary as copies, the sandbox holds no host object to walk back from, and the escape class vm2 has is gone rather than patched. Its interrupt handler and memory limit bound a run from inside, tighter than the five seconds ADR-0072 bounds it from outside. The asyncify build is what lets a transform `await` a host function, which the guarded `fetch` is.

**The web globals ADR-0055 lends are implemented inside the sandbox instead of lent to it.** A bare engine has only ECMAScript; not one of the nineteen is an engine built-in, so the choice is to build them inside or to have none. `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `atob`, `btoa`, `structuredClone`, `AbortController`, `AbortSignal`, `Headers`, `Request` and `Response` are plain JavaScript evaluated inside the sandbox. The four timers, `queueMicrotask`, `performance.now` and `crypto`'s `getRandomValues` and `randomUUID` are driven from the host over the same channel `fetch` already uses (ADR-0072). An in-sandbox `Request` serialises to the shape `requestOf` already sends, so the bridge does not change.

**`crypto.subtle` is absent.** Of the ten sampled transforms none reads `crypto` at all, and a WebCrypto implementation inside the sandbox is out of proportion to that. A transform that wants it fails naming it, as it would on any runtime without it.

**All nineteen globals are provided, not only the ones Recipes are observed to use.** ADR-0055's principle holds: a transform written against TRMNL's serverless runtime should run here without reading an ADR. The sample below is one page of 1266 Recipes, so the unobserved globals are unobserved, not unused.

| global | transforms using it, of the ten sampled |
| --- | --- |
| `URL` | 5 |
| `fetch` | 4 |
| `AbortController`, `setTimeout`, `clearTimeout`, `Request` | 2 each |
| `URLSearchParams`, `TextEncoder`, `TextDecoder` | 1 each |
| `Headers`, `crypto`, `performance`, `structuredClone`, `atob`, `btoa`, `queueMicrotask`, `setInterval` | 0 |

`Response` reads as zero only because a transform receives one from `fetch` rather than naming the constructor.

**The worker thread of ADR-0072 stays.** It holds the host side of the bridge, its termination still ends stray timers, and the interrupt handler becomes a second bound inside the five seconds rather than a replacement for them. ADR-0072 stands unamended but for the engine named inside `runJob`.

Considered and rejected:

- **`isolated-vm`.** The same security property, by V8 isolates rather than WebAssembly, and it needs the same nineteen globals built inside. It is a native module built by `node-gyp-build`, and the production image is `node:26-alpine` built for `linux/amd64` and `linux/arm64`, so musl and arm64 would compile it from source in the image. A `.wasm` is one artifact for every architecture, and nothing discriminated the two engines but that.
- **A child process per run with an empty environment and no file system.** It keeps vm2, so an escape is still an escape onto a poorer landing zone rather than no escape; and ADR-0072 already rejected a process per run on cost.
- **Refusing transforms on a demo Instance.** It answers the anonymous admin and leaves the Recipe gallery, which is the vector on every Instance.
- **`@edge-runtime/primitives` for the globals.** Its `fetch`, `Request` and `Response` sit on Node's own internals, which do not exist inside a WebAssembly engine, so it is a cherry-pick of the parts that are plain JavaScript anyway.

## Consequences

- vm2 leaves the dependency catalogue. Nothing else imports it.
- A transform's globals are the sandbox's own objects, so an error thrown by one is an error of the sandbox's realm; `instanceof` against a host class was never reachable from a transform and still is not.
- The globals are evaluated as source on each run, inside the five seconds ADR-0072 counts from the thread's start, so they are kept small enough not to spend that budget.
- QuickJS interprets where V8 compiled. A transform's own work is slower by roughly an order of magnitude against a Data Source refresh measured in minutes, and the bound on it is unchanged.
- `plugin-transform.service.spec.ts` is the contract this swap is held to, its "has the web globals Node has" and "keeps require, process and the file system out of reach" cases included, with one named case per global the sample above observed.
- ADR-0055's "they are the server's own objects, as the guarded `fetch` is" no longer holds; the globals it lists are still every global a transform has.
