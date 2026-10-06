# Cursor Digidex

The `Cursor Digital Pet: Open Dex` command opens a collection browser and a selected record together. The full catalog remains visible even before the first partner is spawned. Discovery comes from persisted partner evolution events, so `Set Digimon` does not unlock entries.

## Design requirements

Derived from the [shared design conversation](https://chatgpt.com/share/6ac52823-b47c-83ee-aa5d-29f5fb05813c):

- Show a browsable collection alongside the selected Digimon, with grid and list layouts.
- Use a visual language inspired by Digimon's LCD V-Pets and Pendulum devices.
- Use pixel lettering as well as pixel artwork. A monospace system font alone does not meet that requirement.
- Keep the design practical inside a Cursor extension webview.

The public conversation exposes four image placeholders without the original image content. The user subsequently supplied a pixel reference with a brown casing, continuous olive LCD, index on the left and a sprite/stage record on the right. That reference defines the implemented visual direction. List view is the initial layout; evolution and archive information expand below the record.

Additional context comes from the [official Pendulum 20th page](https://digimon.net/20th_pendulum/) and [Bandai's LCD toy history](https://toy.bandai.co.jp/assets/vb-digitalmonster/pdf/digimon_startguide.pdf). The brown device frame and monochrome olive LCD are a fan interface inspired by those devices, not an official canonical Digidex screen.

## Interaction and data

- Search registered English/Japanese romanized names or any catalog ID.
- Filter by stage and by registered/undiscovered status; browse with arrow keys, Home and End.
- Show collection completion, stage, first registration date and distinct partner generations.
- Display previous and next evolutions from the existing V-Pet catalog. Route buttons select the target and clear filters so its index entry stays visible.
- Redact undiscovered names, sprites, URLs and route details. Unknown route targets appear as `???` with their catalog ID.
- Display an explicit archive error when storage is unavailable. The completion count then reads `--` rather than reporting a false zero.
- Refresh on database changes, panel reveal and manual request. Reopening the command reveals the existing panel for that database.
- Persist layout, filters, selection and catalog scroll position through webview recreation.

Species artwork uses the existing frame catalog. Terminal half-blocks are reconstructed into a 16×16 SVG pixel grid with crisp edges; no external images are requested. Silkscreen is bundled locally under the [SIL Open Font License](https://github.com/google/fonts/tree/main/ofl/silkscreen), including its license in the VSIX. Typography and shapes use square corners throughout.

Only catalog IDs are accepted for opening references. The extension resolves the destination from a discovered record and restricts it to `https://digimon.net/`. Catalog strings render through `textContent`, embedded JSON is escaped, scripts use a nonce, and local resource access is limited to the media directory.

The device fills the available webview height, including when the editor's terminal is open. The document has no outer vertical scroll: the catalog and record body scroll independently, while record navigation and the device footer stay visible. Short views reduce frame spacing and place the sprite beside the record name. On narrow panels, the catalog appears above the record, with both scroll regions bounded by the available height. Standard native search and select controls preserve keyboard and assistive technology support.

Typography uses a shared scale: 20 px collection names, 28 px record names (24 px in short views), 18 px body/filter text, 16 px labels/actions and a 14 px minimum for supporting text. Secondary text is darkened for better LCD contrast. Narrow panels keep the same collection name size and stack the catalog and record. List discovery states use pixel check/dash marks inspired by the supplied reference, with the full status retained in each button's accessible name.

## Verification

The real webview HTML was rendered in a local browser with a development-only VS Code API shim and a sample archive. Visual checks covered the default desktop viewport, 965×650 and 965×450 editor views, and a 390×650 viewport. The viewport checks confirm that the document height equals the viewport height, the footer stays inside it, and expanding the archive grows only the record's scrollable content. Search, empty results, stage/discovery filters, list/grid switching, arrow navigation, route selection, state restoration and empty/unavailable archives were exercised. The [desktop screenshot](../packages/cursor-digital-pet/images/digidex-browser.jpg) uses sample discovery data and the existing Komondomon sprite. The extension host integration requires opening the packaged extension in Cursor.
