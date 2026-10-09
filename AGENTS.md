# Workspace conventions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing this repository. It defines
the shared editor setup, code conventions, workspace boundaries, and validation
commands for contributors and coding agents.

- Use the root Biome configuration for formatting and linting. Run commands from
  the repository root with npm; Bun runs the tests.
- Keep shared game rules in `digital-pet-core`, animation in
  `digital-pet-animation`, world data in `digital-pet-fields`, and shared browser
  presentation in `digital-pet-webviews`. Host integrations belong in their app.
- Author browser scripts and styles as `.browser.js` and `.css` files. Import
  them with `with { type: "text" }` where a renderer needs embedded source. Keep
  runtime configuration in the renderer and logic in the browser source file.
- Escape dynamic HTML with `escapeHtml`; use `textContent` for DOM text and retain
  the webview CSP and nonce. Do not introduce executable code in template strings.
- Do not edit generated catalog data or build output manually. Do not introduce
  Prettier, ESLint, or Stylelint without an explicit need outside Biome's coverage.
- Run `npm run check` and the relevant workspace tests. Run `npm run build` for
  rendering, asset-loading, or packaging changes. Use `npm run validate` for a
  change affecting multiple packages.
