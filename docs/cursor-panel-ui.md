# Shared Cursor panel UI

Dex and History remain independent panels with their own models, scripts and extension commands. Their presentation is built from `packages/cursor-digital-pet/src/webview/shared`:

Each panel's domain files live in `webview/panels/dex/` or `webview/panels/history/`. Shared UI files remain in `webview/shared/`.

- `theme.ts`: LCD/case colors, pixel typography and global text rules.
- `panel-styles.ts`: device frame, header/footer, controls, selection states, list/detail layout and scroll regions. Responsive rules keep the frame inside the available viewport.
- `panel-render.ts`: the HTML document, bundled font, CSP, safe JSON serialization and common layout. Each view supplies its heading, accessible labels, summary/toolbar HTML, styles and script.
- `webview-resources.ts`: the neutral resource contract for nonce, font URI and CSP source.
- `panel-script.ts`: frontend helpers for safe text nodes and pixel SVG sprites.
- `pixel-artwork.ts`: reconstruction of terminal half-block artwork into square SVG pixels.

Views configure desktop proportions with `--workspace-columns` and `--toolbar-columns`, and narrow-view row proportions with `--workspace-rows`. The base supplies fallback proportions. Individual controls keep shared spacing and focus behavior. View styles own grid/list arrangement, discovery markers and evolution routes for Dex, and generation rows and timeline for History.

## Adding a view

Create its model, renderer, script and styles beside the existing panels. Call `buildPanelWebviewHtml` with the view's model and resources. Use the existing list/detail IDs and classes for the shared layout; set the layout variables when different proportions are needed. Provide accessible labels that describe the new view rather than inheriting catalog wording.

HTML slots, CSS and scripts are trusted code authored by renderers. Escape any data inserted into an HTML slot; prefer rendering archive strings through the shared `element` helper's `textContent`. The document builder escapes labels and serializes model data safely. Scripts execute inside separate webviews, so sharing helpers does not share UI state between panels.

## Verification

Dex and History model/HTML tests exercise the shared serialization path. An additional shared renderer test covers hostile labels and archive data. Browser checks cover both views, Dex grid/list switching, History filtering and sprites, plus compact and narrow layouts. The refactor preserves the existing visual design and outer viewport sizing.
