# Vendored Claude tokenizer vocabulary

`claude.json` is copied unmodified from the npm package
[`@anthropic-ai/tokenizer@0.0.4`](https://www.npmjs.com/package/@anthropic-ai/tokenizer)
(source: https://github.com/anthropics/anthropic-tokenizer-typescript, tag/commit `v0.0.4` / `bd241051`).

It is vendored so that ai-digest no longer depends on that package, which pulls in
`@types/node@^18` as a runtime dependency. It is loaded by `src/tokenizer.ts`.

`LICENSE` is the license file shipped with that package version, also unmodified.
Note that the upstream `package.json` declares `"license": "Apache-2.0"`, while the
`LICENSE` file in the package and repository contains the MIT license text.
