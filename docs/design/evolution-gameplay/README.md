# Evolution gameplay design evidence

See [the implementation plan](../../evolution-gameplay-plan.md) for decisions,
package ownership, migrations, delivery slices and acceptance criteria.

## Current review decisions

The user retained the Team, Fusion and Recruitment content layouts. Discard the
original companion redesign, route/egg/region redesigns, achievements screen and
prototype navigation. The original preview and screenshots below are historical
evidence, not a production navigation specification.

The revised plan preserves the pet view, adds a circular reserve-face switch in
the area below its name, and places Team second in the Dex / Team / History tab bar. The
new-companion action opens an egg carousel; normal adventure exploration does
not. Achievements stay internal, with the existing regional stars as the visible
boss-win signal. Regional difficulty changes boss tiers only.

The running local application was opened separately from the proposal. See the
[local-server capture](../../../assets/design/evolution-gameplay/current/local-server-open.jpg).
This is the current game, before the planned team/egg/fusion/difficulty features.

`assets/design/evolution-gameplay/current/` contains eleven actual local application/renderer screenshots with an
isolated test save. The [manifest](../../../assets/design/evolution-gameplay/current/capture-manifest.json) identifies
viewports and capture scope. The Cursor image is the current shared renderer
under a test bridge, not a live extension window.

`assets/design/evolution-gameplay/proposed/` contains eight design screens at 320, 390 and 1024 pixels and two
confirmation dialogs. These are proposals, not screenshots of implemented game
features. The preview's screen selector is a review aid, not new production
navigation. Each screen is an independent sample state.

Edit literal markup in `prototype.html`, styles in `prototype.css` and local
interactions in `prototype.browser.js`. Run from the repository root:

```sh
python3 docs/design/evolution-gameplay/build-preview.py
```

The generated `evolution-gameplay.html` is a self-contained inline preview. It
embeds the existing product font, sprites and scenery, makes no network requests,
and does not write to a game save. Do not import it into production renderers.

The team screen supports switching; encounter/fusion screens support confirmation;
egg creation supports principal/reserve selection. Historical review checks exercise those
interactions and measure overflow at all three widths. Production controls must
wait for authoritative host acknowledgement; this documentation preview does not
implement persistence or eligibility.

## Current screenshots

- [companion-desktop](../../../assets/design/evolution-gameplay/current/companion-desktop.png)
- [companion-mobile](../../../assets/design/evolution-gameplay/current/companion-mobile.png)
- [cursor-sidebar](../../../assets/design/evolution-gameplay/current/cursor-sidebar.png)
- [dex-desktop](../../../assets/design/evolution-gameplay/current/dex-desktop.png)
- [dex-routes-mobile](../../../assets/design/evolution-gameplay/current/dex-routes-mobile.png)
- [history-mobile](../../../assets/design/evolution-gameplay/current/history-mobile.png)
- [map-mobile](../../../assets/design/evolution-gameplay/current/map-mobile.png)
- [options-mobile](../../../assets/design/evolution-gameplay/current/options-mobile.png)
- [recruitment-mobile](../../../assets/design/evolution-gameplay/current/recruitment-mobile.png)
- [regions-desktop](../../../assets/design/evolution-gameplay/current/regions-desktop.png)
- [regions-mobile](../../../assets/design/evolution-gameplay/current/regions-mobile.png)

## Proposed screenshots

| Screen | 320 px | 390 px | 1024 px |
| --- | --- | --- | --- |
| companion | [320](../../../assets/design/evolution-gameplay/proposed/companion-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/companion-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/companion-1024.png) |
| achievements | [320](../../../assets/design/evolution-gameplay/proposed/achievements-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/achievements-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/achievements-1024.png) |
| team | [320](../../../assets/design/evolution-gameplay/proposed/team-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/team-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/team-1024.png) |
| recruitment | [320](../../../assets/design/evolution-gameplay/proposed/recruitment-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/recruitment-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/recruitment-1024.png) |
| fusion | [320](../../../assets/design/evolution-gameplay/proposed/fusion-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/fusion-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/fusion-1024.png) |
| routes | [320](../../../assets/design/evolution-gameplay/proposed/routes-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/routes-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/routes-1024.png) |
| eggs | [320](../../../assets/design/evolution-gameplay/proposed/eggs-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/eggs-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/eggs-1024.png) |
| region | [320](../../../assets/design/evolution-gameplay/proposed/region-320.png) | [390](../../../assets/design/evolution-gameplay/proposed/region-390.png) | [1024](../../../assets/design/evolution-gameplay/proposed/region-1024.png) |

- [Egg confirmation](../../../assets/design/evolution-gameplay/proposed/egg-confirmation-390.png)
- [Fusion confirmation](../../../assets/design/evolution-gameplay/proposed/fusion-confirmation-390.png)


## Implemented interface

These are actual production-rendered web views, captured by `team.spec.ts` in an
isolated Spanish browser save on 2026-10-14. The companion capture uses an Agumon
fixture and a starter egg in reserve; it does not modify a real player save.
They supersede the rejected companion/eggs/gallery proposals above.

| View | Evidence |
| --- | --- |
| Existing companion with circular reserve switch | [390 px](../../../assets/design/evolution-gameplay/implemented/companion-switch-390.png) |
| Dex Team tab | [390 px](../../../assets/design/evolution-gameplay/implemented/team-390.png), [320 px](../../../assets/design/evolution-gameplay/implemented/team-320.png) |
| New Journey egg carousel and slot preview (egg information remains here) | [390 px](../../../assets/design/evolution-gameplay/implemented/egg-carousel-390.png) |
| Regions ordered by difficulty | [390 px](../../../assets/design/evolution-gameplay/implemented/regions-difficulty-390.png) |
| Easy boss tiers | [390 px](../../../assets/design/evolution-gameplay/implemented/bosses-easy-390.png) |
| Hard boss tiers | [390 px](../../../assets/design/evolution-gameplay/implemented/bosses-hard-390.png) |

Verified flows include cancelling egg creation, filling the empty reserve without
retiring the principal, switching both ways, rejecting stale/locked/busy actions,
reopening Team through its URL, and exporting/importing/restoring both partners.
Chromium regression checks also cover existing offline routes, source selection,
translations and legacy boss stars. Safari checks cover the team, carousel and
regional difficulty flows. Fusion and recruitment selection remain design
references; these screenshots do not claim those features are implemented.


The 2026-10-14 interface refinement removes the Eggs tab and New Companion button
from Team, hides successful-update copy and unrestricted care labels, and adds
member links to their Dex records. The circular reserve control sits below the
companion name. Regions have a matching Next control beside All Regions.
[Region navigation](../../../assets/design/evolution-gameplay/refined/regions-navigation-390.png),
[companion](../../../assets/design/evolution-gameplay/refined/companion-switch-390.png) and
[Team](../../../assets/design/evolution-gameplay/refined/team-390.png) captures show
that refinement. The former Eggs collection capture is historical evidence only.

The final 2026-10-14 polish anchors the Team action and explanation at the bottom,
uses a circular portrait with an integrated rotation badge, and imports real
Omnipet egg sprites. These latest Chromium captures use an isolated test save:

| View | Evidence |
| --- | --- |
| Quick switch below the name | [Egg in reserve](../../../assets/design/evolution-gameplay/polished/companion-switch-390.png), [Agumon in reserve](../../../assets/design/evolution-gameplay/polished/companion-switch-face-390.png) |
| Team with bottom actions | [390 px](../../../assets/design/evolution-gameplay/polished/team-390.png), [320 px](../../../assets/design/evolution-gameplay/polished/team-320.png), [desktop](../../../assets/design/evolution-gameplay/polished/team-desktop.png) |
| New Journey with imported egg artwork | [390 px](../../../assets/design/evolution-gameplay/polished/egg-carousel-390.png) |

The complete visual import and its separate game-origin assignments are recorded
in [data sources](../../data-sources.md#imported-digitama-designs). The offline
browser test verifies the carousel and distinct sprites while disconnected.

## Regional Digitamas

The source's 44 color and LCD designs were visually reviewed before choosing ten
distinct eggs for the ten regions. This is an authored visual assignment, not a
claim of source-provided Field membership or hatch rules. The village egg starts
available; each of the other nine is unlocked by that region's boss victories.

[Selection board: original color and LCD artwork](../../../assets/design/evolution-gameplay/regional-eggs/selection.png)

Latest actual Chromium captures verify the smaller principal egg and previews:
[companion](../../../assets/design/evolution-gameplay/regional-eggs/companion-switch-face-390.png),
[Team](../../../assets/design/evolution-gameplay/regional-eggs/team-390.png),
[320 px Team](../../../assets/design/evolution-gameplay/regional-eggs/team-320.png),
[desktop Team](../../../assets/design/evolution-gameplay/regional-eggs/team-desktop.png),
[quick switch](../../../assets/design/evolution-gameplay/regional-eggs/companion-switch-390.png),
[starter carousel](../../../assets/design/evolution-gameplay/regional-eggs/egg-carousel-390.png).
The [unlocked Metal Empire egg](../../../assets/design/evolution-gameplay/regional-eggs/regional-machine-egg-390.png)
capture follows an isolated test-save boss victory and verifies regional creation
and origin persistence after reload.
