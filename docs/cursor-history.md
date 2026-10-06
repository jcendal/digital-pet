# Cursor generation history

`Cursor Digital Pet: Open History` remains an independent command and panel. It shares the Digidex's brown device frame, olive LCD, bundled Silkscreen font, pixel artwork, and viewport sizing. It has no internal tabs.

Both views use the [shared panel UI](cursor-panel-ui.md). History supplies its own generation rows and timeline styles rather than importing Dex styles.

The left column lists partner generations, newest first, with current/retired status. The right column shows the last recorded Digimon, its stage, creation/retirement dates, and a timeline of actual archive events. Consecutive sightings of the same species collapse into one step using its first timestamp; later returns to that species remain visible. Events sort chronologically. These are recorded journeys, rather than the possible evolution routes shown in the Dex.

Search matches generation numbers and Digimon names/catalog IDs anywhere in the journey. Status filters isolate current or retired partners. Arrow keys, Home and End navigate generations. Selection, filters and catalog scroll persist when the webview is recreated. A button opens the last recorded species in the separate Digidex panel, clears its filters and selects that record. Missing catalog entries and generations without events disable this action.

The device fills the available viewport; the generation list and record body scroll independently. Short layouts put the sprite beside the record name. Narrow views stack the generation list above the record. Empty history and unavailable storage have distinct messages; unavailable storage displays `--` rather than a misleading zero count.

The panel refreshes on database changes, reveal and manual request, and reuses an existing panel for the same database. Database watchers and message handlers are disposed with the panel. Archive strings use `textContent`, embedded JSON escapes HTML delimiters, scripts use a nonce, and webview resources are limited to bundled media. Dex destinations are validated against the selected partner's final recorded catalog entry by the extension host.

## Verification

Model tests cover chronological ordering, repeated sightings, returns to previous species, retired generations, generations without events, missing catalog entries, storage errors and JSON escaping. Browser verification uses real generated webview HTML with a development-only VS Code API shim and example partner records. It covers search, empty results, status filtering, keyboard navigation, persisted selection, refresh and Dex messages, plus 965×650, 965×450 and 390×650 views. The document remains viewport height with the footer inside it. Empty, unavailable and no-event archives are also checked.

The [History screenshot](../packages/cursor-digital-pet/images/history-browser.jpg) contains sample records. Extension host navigation still requires opening the packaged extension in Cursor.
