# A Data Source request is given up after ten seconds

TRMNL's poller waits ten seconds for a polled host (trmnlp's `OutboundRequest::TIMEOUT_SECONDS`, mirroring the hosted service), and Recipes are written for a host that answers within that. Kuroshiro called `fetch` with no signal, so a host that accepted the connection and never answered held the scheduled render, and every Data Source fetched beside it, until Node's own headers timeout minutes later.

**A Data Source's request is aborted after ten seconds without an answer, and reads as an error marker saying so.** The same ten seconds apply to each line of a several-line URL on its own (ADR-0058), as each is its own request. A transform's own `fetch` keeps the signal it passes, if any (ADR-0052); the transform as a whole already has its five seconds.

Considered and rejected:

- **A longer wait, since a self-hosted server has no plan to protect.** A Recipe that needs longer than TRMNL gives it does not run on TRMNL either, and a render tick waiting minutes on one host delays every other Plugin's tick behind it.
- **Retrying once on a timeout, as trmnlp does.** A host that took ten seconds to not answer is unlikely to answer in the next ten, and the next scheduled tick is the retry.

## Consequences

- An error marker's message, `The host did not answer within 10 seconds.`, reads in the template and in the Data Source's last fetch error like any other failure (ADR-0005, ADR-0025).
