# A transform runs on a thread of its own that its timeout terminates

vm2's `timeout` bounds only the synchronous part of `vm.run`; its README says so ("Timeout does NOT work on any method returned by VM"). A transform that awaits once and then spins, `await fetch(url); for (;;) {}`, returned a pending promise in time, and its continuation then ran on the server's event loop, where the `withinTimeout` race of ADR-0052 could never fire because nothing else ran. Every `/display` poll, the admin API and the scheduler stopped until the process was killed, and a Recipe imported from trmnl.com is third-party code.

**Each transform runs in a `worker_threads` Worker that `PluginTransformService` terminates when the run outlasts its five seconds**, so the bound covers the code after an `await`, a timer and a `setInterval` alike. Inside the thread the transform runs in the same vm2 sandbox as before, with the thread's own web globals (ADR-0055), so its timers end with the thread.

**The guarded `fetch` stays on the server and is lent over messages.** The thread sends the request as plain data, the server makes it with the `fetch` ADR-0052 hands the transform and sends the whole response back, status, headers and body; an `AbortSignal` the transform passes aborts the server's request, and a terminated run aborts the requests it left open.

**What a transform returns leaves the thread as JSON**, stringified inside the sandbox: a vm2 object cannot be posted between threads, and the result becomes merge variables and a Previous Output, which are JSON already. `console.log` turns its arguments to text inside the sandbox too, so no transform code runs when the server logs it.

Considered and rejected:

- **vm2's `allowAsync: false` and refusing a thenable result.** Seven of the thirteen featured Recipes' transforms `await fetch` (ADR-0052); they would all stop working.
- **A child process per run.** It bounds the run as well, at the cost of a whole Node process per Data Source refresh; a thread starts faster and `terminate()` stops it as surely.
- **A pool of reused threads.** A terminated thread cannot be reused, and a transform could leave globals or timers behind for the next one; one thread per run costs tens of milliseconds against a refresh measured in minutes.

## Consequences

- tsup bundles `plugin-transform.worker.ts` beside `main.js` as a second entry; under test Node runs the `.ts` source as it is, so the worker imports only Node, vm2 and types.
- The fetch the transform sees reads its headers lower-cased, as `Headers` stores them, and its `Response` is rebuilt from the server's, with the same status, headers, body and `url`.
- A result loses what JSON cannot carry: a `Date` arrives as its ISO text and an `undefined` property is dropped, as they would be once stored.
- ADR-0055's "the five seconds still bound the run" holds only from this decision on.
