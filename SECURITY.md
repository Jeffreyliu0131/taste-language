# Security Policy

## Supported scope

Security fixes are considered for the current default branch. Historical snapshots and local forks are not maintained. This repository is a local experience prototype, not a hosted service and not a production security boundary.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub private vulnerability reporting if it is enabled for the repository. Otherwise, contact the repository owner through a private method shown on their GitHub profile. Include the affected version or commit, a minimal reproduction, impact, and any safe mitigation you have identified.

Do not include secrets, personal data, private photos, identifiable people or locations, or rights-unclear images in a report. Use synthetic placeholders and the registered fixtures whenever possible.

Maintainers will assess the report before discussing disclosure. Response and remediation timing depends on severity and maintainer availability; this project does not promise a production-service SLA.

## Known non-security boundaries

- `localStorage` is convenience persistence, not confidential, tamper-proof, or forensically erasable storage.
- Client-side holdout and lineup concealment is not research-grade blinding; developer tools can inspect frozen state.
- The demo digest detects ordinary corruption but is not a cryptographic signature.
- The local CSP and `127.0.0.1` preview are not a production hosting policy.

These limitations should not be reported as new vulnerabilities unless a change creates impact beyond the documented boundary.
