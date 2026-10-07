# Contributing to Kuroshiro

Thanks for wanting to make Kuroshiro better! Bug reports, ideas, questions, and pull requests are all welcome.

## Getting started

- Open an issue or join a discussion for bugs, ideas, or questions.
- Fork, branch, and submit a pull request (PR).
- See the [Quick Start](README.md#-quick-start-dev-mode) in the README for running Kuroshiro locally.

## Coding guidelines

- Follow the existing code style; `pnpm lint` and the pre-commit hooks enforce most of it.
- Use the domain language from [`CONTEXT.md`](CONTEXT.md), and respect the decisions recorded in [`docs/adr`](docs/adr). If your change contradicts an ADR, say so in the PR so we can discuss it.
- Run all tests before submitting a PR.
- `pnpm fallow:ci` runs in CI and fails on new dead code, duplication, or complexity hotspots; see [docs/agents/fallow.md](docs/agents/fallow.md) for how the baselines work.
- **We use [release-please](https://github.com/googleapis/release-please)!** Use [Conventional Commits](https://www.conventionalcommits.org/) for your commit messages to enable automatic versioning and changelogs.

## AI policy

Kuroshiro is developed with heavy use of AI coding tools. Agents help triage issues, write specs and Architecture Decision Records, implement features, and review pull requests, all steered by a human maintainer. Nothing is merged without a human having reviewed it. The agent-facing instructions live in [`AGENTS.md`](AGENTS.md) and [`docs/agents`](docs/agents), so the same guidelines apply whether code is written by a person or a model.

Contributions made with the help of LLMs or AI coding tools are welcome, as long as:

- they follow our [Code of Conduct](CODE_OF_CONDUCT.md) and the [coding guidelines](#coding-guidelines) above, and
- a human has reviewed the change at least once before it is submitted. You are responsible for what you submit: understand it, be able to explain it, and make sure it actually works.

Unreviewed, bulk-generated issues or pull requests may be closed without further discussion.

## Code of Conduct

Everyone taking part in this project is expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
