# Third-party notices

Taste Language includes or uses open-source software and data maintained by third parties. The repository's MIT license does not replace their licenses.

## Runtime dependencies

| Material | Copyright / project notice | License | Source |
|---|---|---|---|
| Phosphor Icons React | Copyright © 2020 Phosphor Icons | MIT | <https://github.com/phosphor-icons/react> |
| Radix Themes and Radix UI packages | Copyright © 2023 WorkOS and respective contributors | MIT | <https://github.com/radix-ui/themes> |
| React and React DOM | Copyright © Meta Platforms, Inc. and affiliates | MIT | <https://github.com/facebook/react> |
| Zod | Copyright © Colin McDonnell and contributors | MIT | <https://github.com/colinhacks/zod> |

The MIT permission and warranty text is reproduced in the relevant installed package licenses. The same standard text is also present in this repository's [LICENSE](LICENSE), with the Taste Language copyright notice applying only to this project.

## Development and test tooling

The development dependency graph includes software under MIT, Apache-2.0, MPL-2.0, BSD, ISC, BlueOak-1.0.0, and other permissive licenses. Notable top-level tools include:

- Playwright and TypeScript under Apache-2.0;
- axe-core Playwright integration under MPL-2.0;
- Vite, Vitest, ESLint, Testing Library, jsdom, and related type packages under their package-declared licenses.

Exact installed versions, integrity hashes, dependency relationships, and SPDX-style license identifiers are recorded in `package-lock.json` and the corresponding package metadata. Development tooling is not intentionally shipped as part of the browser runtime bundle.

## Creative Commons data in the dependency graph

| Material | License | Source | Use in this project |
|---|---|---|---|
| `caniuse-lite` browser support data, package author Ben Briggs and Browserslist contributors | CC BY 4.0 | <https://github.com/browserslist/caniuse-lite> | Transitive build-tool data; not a source for project fixture images or annotations |
| `mdn-data` web-platform data, Mozilla Developer Network contributors | CC0 1.0 | <https://github.com/mdn/data> | Transitive tooling data; not a source for project fixture images or annotations |

The applicable Creative Commons legal texts are included at [LICENSES/CC-BY-4.0.txt](LICENSES/CC-BY-4.0.txt) and [LICENSES/CC0-1.0.txt](LICENSES/CC0-1.0.txt).

## No endorsement

The names of third-party projects and rightsholders are provided for notice and attribution only. They do not imply sponsorship, endorsement, or affiliation with Taste Language.
