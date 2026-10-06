# Cursor partner display

The Cursor Explorer sidebar uses the same LCD palette and pixel font as Dex and History.
A compact identity row sits above a full-width arena, leaving the partner free to walk
across the sidebar. Small Dex/History actions sit at the bottom right. Combat and
evolution expand the arena into the progress area. Both layouts keep the same
overall height so switching phases does not move the shortcuts. In battle, the
identity row shows the partner on the left and the opponent on the right. Animated
views retain the divider above the shortcuts. The SVG
viewport retains the reported arena column width as the partner moves, preserving
pixel size across walking positions. During battle, three outlined score boxes sit
above each fighter, filled for successful hits, and a larger caption sits below.
Shared battle callbacks supply score/caption metadata and frame HUD coordinates;
Cursor replaces those frame regions with its LCD HUD while OpenCode retains the
shared text frame.

## Shared animation contract

`digital-pet-animation/sessions/presentation-state.ts` defines semantic events:
`battle`, `evolving`, `evolved`, and `defeated`, including the participating catalog IDs.
Evolution sessions emit these events alongside the existing artwork callbacks. The
reveal event occurs before the target's reveal frames. Frame sequences, timings,
battle results, and persistence remain in the shared animation/domain packages.

Cursor and OpenCode consume the same events. Cursor chooses the LCD layout and
converts Unicode block frames into SVG pixels, retaining shading and battle captions.
OpenCode retains its terminal layout and uses the phase in its existing status row.
Each frontend returns to `idle` when its presentation ends.

## Cursor implementation

- `sidebar-document.ts`: accessible HTML and resource CSP.
- `sidebar-styles.ts`: compact sidebar layout layered over the shared panel theme.
- `sidebar-script.ts`: SVG frame rendering, model/state updates, progress, and actions.
- `sidebar-orchestrator.ts`: maps shared phase IDs to the visible partner model.
- `provider.ts`: local font resource and whitelisted Dex/History commands. The ready
  handshake replays state, model, and idle artwork after the webview script loads.

## Verification

The real HTML and shared frames were previewed at 350px and 240px widths. Rest,
combat, evolution, result, frozen, final-stage, and empty views were inspected.
At 350px, occupied partner views are approximately 308px high; at 240px, 304px.
A shorter host area can still scroll to preserve readable controls.

The saved JPG previews in `packages/cursor-digital-pet/images/` use sample data.
The VSIX can be installed in Cursor to verify the final Explorer host integration.
