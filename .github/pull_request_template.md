## What changed

Describe the smallest user-visible or integrity change and the bad case it addresses.

## Invariants

- [ ] Scope remains limited to photo-visible preference language in the fixed long-study context.
- [ ] Freeze still precedes holdout responses and language tasks.
- [ ] Probability remains `null`; abstention remains possible.
- [ ] Choice, Language, and Delivery records remain separate.
- [ ] No API key, analytics, hidden external request, or silent fallback was added.

## Privacy and rights

- [ ] This pull request contains no real or identifiable people, private or identifiable places, personal data, private photos, secrets, or rights-unclear media.
- [ ] Any fixture change has an auditable manifest entry, permitted public use, SHA-256, dimensions, and split/group review.
- [ ] Screenshots use only registered project fixtures and do not expose private paths or exported notes.

## Verification

- [ ] `npm run validate:fixtures`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] `npm run test:e2e`

List actual results and any intentionally untested path.

## Remaining limitations

State what this change does not prove or support. The evidence verdict remains **Validate first**.
