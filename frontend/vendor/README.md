# Vendored dependencies

- `lightweight-charts-5.3.0`: official npm package `lightweight-charts@5.3.0`, https://registry.npmjs.org/lightweight-charts/-/lightweight-charts-5.3.0.tgz ; Apache-2.0. Production standalone file is unmodified, including its copyright/license header. LICENSE is adjacent. Loaded only for the explicit v5 preview and lab; existing v4 attribution is retained.
- `line-tools`: difurious MPL-2.0 plugins, pinned source commits in `line-tools/sources.json`; source is available at each repository's `tree/<commit>` URL. Bundles built with upstream Rollup configurations; sourceMappingURL comments omitted because source maps are not distributed. No application-specific modification to plugin logic. LICENSE adjacent. Loaded only by line-tools-lab.html.

See V5_PREVIEW.md in the repository root for test scope and migration limitations.

Upstream core/plugin package.json contains a placeholder `npm test` that exits with an error. Do not describe upstream tests as passing. Local bridge tests and browser lab observations are documented in V5_PREVIEW.md / AGENTS.md.
