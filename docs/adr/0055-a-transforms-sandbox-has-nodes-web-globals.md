# A transform's sandbox has Node's web globals

TRMNL runs serverless code on Node 20 (help.trmnl.com, "Serverless"), where `AbortController`, `setTimeout`, `URL`, `TextEncoder` and the other web-standard globals are simply there. Two of the twenty-five Recipes on the second page of trmnl.com/recipes bound their `fetch` with an `AbortController` and a timer, and two more build their request with `URL`; the sandbox of ADR-0051 and ADR-0052 exposed only `input`, `console` and the guarded `fetch`, so the first two rendered their error state with "AbortController is not defined".

**The sandbox hands a transform the web-standard globals Node has**: `AbortController`, `AbortSignal`, the four timer functions, `queueMicrotask`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `atob`, `btoa`, `structuredClone`, `performance`, the Web Crypto `crypto`, `Headers`, `Request` and `Response`. They are the server's own objects, as the guarded `fetch` is. Node's `require`, `process` and the file system stay out of reach, as before.

**The five seconds still bound the run.** A transform that waits on a timer waits inside the same `withinTimeout` race that bounds its awaits (ADR-0052), so a timer cannot hold a Data Source longer than its `fetch` could. _(Superseded in part by ADR-0072: the race never bound CPU work after an `await`, which vm2's timeout does not cover, so a transform now runs on a thread its timeout terminates.)_

Considered and rejected:

- **Only `AbortController` and `setTimeout`, the two the Recipes needed.** The next Recipe would need the next global, and the list above is the one Node 20 documents as always present; a transform written against TRMNL's runtime should run here without reading an ADR.
- **A fresh realm's own globals through vm2's `NodeVM`.** That is the sandbox variant with `require` built in, and a `URL` from the host is as good as one from the realm.

## Consequences

- `PluginTransformService` spreads the globals into the vm2 sandbox before `input`, so a transform's own names win as they did.
- A transform can now schedule work with `setInterval`; the timeout rejects the run but the interval keeps firing in the host until the process ends. A Recipe's transform has no reason to, and a bounded run that clears its own timers is what TRMNL's runtime expects too. _(Superseded by ADR-0072: the timers are the transform's thread's, and end with the run.)_
