# Gameplay architecture and review

## Findings and changes

The catalogue already contained an explicit evolution graph: **650 nodes, 2,262 edges,
114 terminal forms; all 650 nodes are reachable from Digitama**. Selection already used
`nextEvolutions`, not the entire next stage. The missing safeguard was resolution:
a stored pending target could be an unrelated existing species. Core now validates the
branch, target and opponent before resolving either a win or a loss. Desktop sessions
also check that the partner and pending battle still match the presented snapshot.

Combat previously selected the winner with a coin toss and manufactured hits to reach
that result. Browser presentation always selected the player. Both policies are removed.
Core generates actual attack rolls; all hosts use the same presentation session.

Browser state models, IndexedDB, presentation ownership, evolution and the food widget
are separate modules. Animation checkpoints use a read-only identity query. The visibility
gate is iterative and has no DOM dependency. SQLite remains read-only in web mode.

## Layer ownership

| Layer | Responsibilities |
| --- | --- |
| `digital-pet-core/domain` | Evolution branch validation, opposed hit probability, battle simulation, four-hour food timing and experience reward |
| `digital-pet-core/data` | Existing evolution graph and explicit per-species strength/evasion values |
| `digital-pet-core/application` | Resolve a presented battle through a repository port; reject stale snapshots |
| `digital-pet-animation` | Render shots, HUD, transformation, defeat and eating frames; no IndexedDB or frontend APIs |
| `digital-pet-webviews` | Shared panels and discovery-aware combat statistics in Dex |
| `web-digital-pet/local-progress` | Browser growth strategy and immutable save transitions, combining core rules |
| `web-digital-pet/browser-store` | Atomic IndexedDB mutations, backups and read-only identity checks |
| `web-digital-pet/browser-evolution` | Foreground gating, shared presentation and conditional save completion |
| `web-digital-pet/browser-food` | Pixel apple, accessible click action, shared eating controller and animation ownership |
| Cursor/OpenCode adapters | Host events, SQLite repositories and the shared animation session |

The browser facade composes these pieces. Core domain imports no data catalogue, browser,
filesystem, animation or host API. Food state belongs to browser saves; rendering a computer
save does not expose a feeding action.

## Evolution policy and research

Preserve the project's explicit game/V-Pet branches, including named alternative forms and
same-stage changes. Filtering every edge to `stage + 1` would break existing routes and
catalogue coverage. Selection and completion must use the same graph. The egg's many
offspring represent the shared starter egg, not a species-specific lineage.

There is no single universal anime tree suitable for the entire catalogue. Bandai Namco's
[Digimon Survive description](https://www.bandainamcoent.com/games/digimon-survive) describes
evolution influenced by player choices. The [Digital Monster guide](https://humulos.com/digimon/dm/)
organizes evolution charts by device version. These support retaining alternative branches;
they do **not** certify all 2,262 existing project edges. The current graph is an inherited
project dataset, not a newly verified official universal chart. Future corrections should
include a device/game/source per changed edge and preserve reachability tests.

## Combat policy

Every catalogue species has an explicit immutable `(strength, evasion)` pair in `data/combat-stats.ts`,
validated as integers from 0 to 100. These are initial **game balance values**, not official
Digimon statistics. Stage baselines and broad brute/agile/machine/sacred/plant profiles were
used for the first pass, with individual overrides; runtime behavior reads explicit IDs and
does not guess values from names. Custom injected catalogues use neutral stats; tests ensure
the shipped catalogue never depends on that fallback.

### Early forms

All 31 Baby I and 37 Baby II forms now have individually chosen, distinct profiles.
Keep changes within seven points of their original `(25, 35)` and `(35, 40)` baselines,
and each stage's average within three points. Familiar starters receive a modest advantage,
distributed across offense, evasion or both. They are not uniformly the best in both stats.
Baby I strength ranges from 22–30 and evasion from 31–41; Baby II strength ranges from
31–42 and evasion from 35–47. Defense continues to mean avoiding hits, not armor or damage reduction.

These are gameplay interpretations inspired by official descriptions: [Koromon](https://digimon.net/reference_en/detail.php?directory_name=koromon)
is a versatile, vigorous starter; [Tokomon](https://digimon.net/reference_en/detail.php?directory_name=tokomon)
leans toward attack because of its bite; [Nyaromon](https://digimon.net/reference_en/detail.php?directory_name=nyaromon)
has a weaker attack and an evasive profile; [Poyomon](https://digimon.net/reference_en/detail.php?directory_name=poyomon)
leans toward evasion, inspired by its floating body. The numerical values and starter bonuses
are our own balancing choices. Each row documents its intended gameplay role.

Balance tests check coverage, variation, specialist tradeoffs, modest starter advantages,
and that the difference between opposing hit probabilities remains below 13 percentage
points in every same-stage pairing. This keeps the new profiles noticeable without making
early battles one-sided.

Compared alternatives:

- Linear probability with clamping: easy to explain, but reaches caps abruptly.
- Strength divided by strength plus evasion: undefined at `(0, 0)` without another policy.
- Logistic opposed check: smooth, symmetric around equal scores, works across the full range.

Chosen adaptation of the logistic function described in
[Stanford CS229 notes](https://see.stanford.edu/materials/aimlcs229/cs229-notes1.pdf):

```text
p(hit) = clamp(1 / (1 + exp(-(attacker.strength - defender.evasion) / 25)), 0.05, 0.95)
```

Equal scores: 50%; strength 20 points higher: approximately 69%; 20 points lower:
approximately 31%. The scale and 5–95% caps are our balance decisions. Randomize the first
attacker, alternate attacks and roll each hit independently. First to three hits wins.
After 24 attacks without a winner, display a draw. Defeat and draw reset the experience
gauge without evolution. No hits or winners are forced. Only a victory presents and
commits an allowed transformation.

## Browser food lifecycle

- Eggs have no food state. Hatching and every successful evolution schedule an apple in four hours.
- Existing saves without food metadata schedule their first apple on migration/read.
- Food is either `{ kind: "scheduled", availableAt }` or `{ kind: "available" }`.
  Available food has no date, persists through closing the app and never accumulates.
- Consumption happens in one IndexedDB transaction, checking the partner identity and
  availability. A second click/view cannot consume the same apple twice.
- Eating adds 25% of the selected stage requirement (Low/Normal/High), capped at the
  threshold, and schedules the next apple four hours after consumption.
- Eating uses the existing `eat_1`/`eat_2` frames. Species without those frames retain the
  animation controller's existing fallback. Final forms can eat without gaining unused XP.
- If food fills the gauge, queue the evolution. Finish eating before presenting the battle.
  Never evolve or record its target until the foreground presentation completes.
- Pending battles disable feeding. A loss preserves the existing food state. Transfers and
  backups preserve available/scheduled food and validate their shape; legacy saves remain valid.

## Store metadata

Cursor/VS Code uses the allowed `Visualization` and `Other` categories plus searchable
keywords ([extension manifest reference](https://code.visualstudio.com/api/references/extension-manifest)).
OpenCode's npm package uses `keywords`; npm has no package category field
([npm package.json reference](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)).
Web uses PWA manifest categories `games` and `entertainment`, plus package keywords
([manifest categories](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/categories)).
Metadata prepares discovery; it does not publish or submit an app to a store.

## Verification gates

Run root `npm run check`, `npm run test`, `npm run build` and the web static export.
Core tests cover all-species graph reachability/stat coverage, branch rejection, probability
properties, deterministic battle outcomes and food timing. Web tests cover reward/capping,
one-food consumption, eggs, migration, transfer, stale identity and foreground completion.
Animation tests cover winning, losing, drawing and rejected/stale sessions. Browser checks
exercise an imported disposable save through the real food button and inspect Dex statistics.
