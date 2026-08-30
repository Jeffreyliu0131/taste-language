# Contributing

Thanks for helping improve Taste Language. This repository is a narrow, deterministic local prototype for one claim only: in the fixed context of studying alone for a long time, turn choices between space photos into photo-visible preference language that can be inspected, edited, and challenged.

The evidence verdict remains **Validate first**. A working prototype does not establish user demand, prediction accuracy, real-place suitability, or production readiness.

## Scope guardrails

Contributions must stay within the current A′ boundary:

- describe only visible properties of registered space photos;
- keep probability `null` and preserve ordinal/margin/abstain outputs;
- keep Choice, Language, and Delivery records separate;
- preserve the one-time freeze before holdout and language tasks;
- keep the default path local-first, deterministic, and free of API keys or external services.

Do not add real-place recommendations, noise/outlet/comfort claims, maps, 3D, Taste Galaxy, personality or sensitive inference, open-web scraping, analytics, or hidden network dependencies.

## Privacy and image rights

Do not upload or attach:

- photos of real or identifiable people;
- private photos or personal data;
- identifiable real homes, workplaces, schools, cafes, or other locations;
- images whose source, consent, or redistribution rights are unclear.

Fixture changes require an auditable manifest entry, explicit allowed uses, a stable SHA-256, declared dimensions, and training/holdout group isolation. A public pull request must not rely on an ignored local file.

## Local setup

Use Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm run validate:fixtures
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

## Pull requests

Keep changes small and explain:

1. the user-visible or integrity problem;
2. the invariant that must remain true;
3. the bad case or recovery path covered;
4. the commands run and their results;
5. any remaining limitation.

Update tests with behavior changes. Use only repository fixtures in screenshots. Do not bypass `.gitignore` to publish internal ledgers, raw review material, local exports, traces, or unapproved screenshots.

Report security issues privately as described in [SECURITY.md](SECURITY.md), not in a public issue.
