# Evolution catalogue audit

Reviewed on 2026-10-13 against [Digitama Hatchery / Humulos](https://humulos.com/digimon/).

## Finding

The catalogue is a combined graph of species connections, rather than a faithful
simulation of one device's evolution trees. It does not store a connection's
device, normal-evolution/Jogress distinction, or additional requirements.
`pickEvolutionTarget` chooses uniformly from every outgoing connection when the
experience threshold is reached. A connection that exists in a guide therefore
does not imply that the game's way of activating it matches that guide.

The initial review did not change evolution rules. The implementation below applies
the findings without rewriting existing companions or their history.

## Reported Garurumon evolution

Garurumon (`4-046`) has 13 outgoing connections in the game, including Orochimon
(`5-104`). Humulos lists that connection for Vital Bracelet: it requires Jogress
with a Virus Adult. This was verified in the Garurumon detail card linked from
the [Gabumon EX guide](https://humulos.com/digimon/vbdm/ex/#gabu_ex).

The game instead treats it as an ordinary random experience evolution, with a
1-in-13 chance when choosing Garurumon's target. The connection itself is
documented; its prerequisite is absent from the game.

Humulos also lists normal options such as Were Garurumon, Valvemon and Waru
Seadramon for that device. The familiar Were Garurumon route appears in
[Pendulum Z](https://humulos.com/digimon/penz/), where Garurumon can also become
Beowolfmon through Jogress. Those device-specific alternatives are not interchangeable
with a single universal tree.

## Catalogue-wide comparison

The local catalogue contains 650 nodes and 2,262 directed connections. Exact
English/Japanese names were matched after removing punctuation and spaces;
unmatched names and ambiguous aliases were excluded from automatic comparisons.
Names of distinct variants were not intentionally collapsed.

The comparison used embedded evolution detail cards and named connection lines
in the downloaded charts for Digital Monster 1997, Digital Monster 20th, Digital
Monster Color, the three Digital Monster X series, Pendulum 1998, Pendulum Color,
Pendulum Z, Vital Bracelet and Vital Bracelet BE, plus Garurumon's Vital Bracelet
detail card. The Pendulum 20th page was inspected, but its unnamed colour-based
connections were excluded from automated extraction.

| Result | Count |
| --- | ---: |
| Local species identified on the inspected pages | 610 |
| Local connections also found in the extracted Humulos data | 1,725 |
| Local connections not verified by this extraction | 537 |
| Extracted Humulos connections between local species absent from the game | 63 |

These are coverage counts, not a certification of every tree. In particular,
**unverified does not mean invalid**. The extraction does not cover every detail
card, device, naming variant, conditional connection or newer crossover device.
The 63 absent connections are candidates for a catalogue policy decision, rather
than instructions to import every device's tree indiscriminately.

## Manually checked discrepancies

| Connection | Humulos evidence | Current game |
| --- | --- | --- |
| Garurumon → Orochimon | Vital Bracelet, Jogress with a Virus Adult | Selected as a normal experience evolution |
| Dracomon → Coredramon Blue / Green | [Digital Monster 20th](https://humulos.com/digimon/dm20/), determined by the Slayerdra / Breakdra egg | Both missing; Dracomon has only GeoGreymon |
| Garurumon → Beowolfmon | [Pendulum Z](https://humulos.com/digimon/penz/), Jogress with a Data or Virus Adult | Missing |
| Garurumon → Asuramon | [Pendulum 1998](https://humulos.com/digimon/pen/), Virus Busters version, Jogress with a Vaccine Adult | Missing |

The graph also contains 34 same-stage connections, 3 backwards-stage connections
and 37 connections that skip stages. These warrant a separate stage/variant audit;
those counts alone do not prove that the connections are wrong, because devices
can classify the same species differently or support transformations and fusion.

## Recommended model

Keep the complete species collection, but give connections provenance and a kind
such as normal evolution or Jogress. Experience evolution should draw from the
chosen set of normal routes. Fusion routes should require their own gameplay
mechanic, and routes from different devices should follow an explicit policy.

Before changing persisted pending evolution targets, define how previously valid
targets are handled. Existing raised companions and history should remain intact.
Tests should cover the requirement distinction and reference-backed routes;
reachability and valid IDs alone do not establish fidelity to a device's trees.

## Applied on 2026-10-14

The runtime now uses a generated reference snapshot with 1,898 documented
connections: 1,465 normal routes, 230 Jogress routes and 203 other special routes.
The game's single egg keeps its existing hatch choices. Legacy connections absent
from the snapshot remain usable for resolving already pending saves, but cannot
be chosen for a new experience evolution and are not displayed as confirmed Dex
routes. Documented missing branches such as Dracomon → Coredramon Blue / Green
are included. The original generated species catalogue was not edited.

Normal evolution uses the number of piles currently unclean at target selection,
as requested: 0–3. Documented care-mistake ranges are clamped to that scale;
requirements for 3 or more mistakes use the three-pile category. When a route has
documented care ranges, those ranges take precedence over alternatives that omit
care. Multiple documented care ranges are combined. A route without a care
requirement permits any of the four pile counts. Normal device timing, effort,
level and ordinary battle-count requirements are adapted to the game's EXP
threshold and existing evolution battle, rather than adding new training systems.

The policy intentionally combines confirmed routes from the supported devices;
it is not a complete emulator of any particular device. Jogress, connection/slot
unlocks, unusual victory unlocks, adventure-area unlocks and same-stage changes
are separate special routes. They are shown as locked in the Dex and are not
activated by ordinary EXP. This change does not implement fusion partners,
training counters, device connections or device-specific egg variants.

The care decision is shared across browser timed EXP, food, cleaning, Cursor and
OpenCode token receipts, and adventure rewards. Offline piles are advanced when
deciding the target. Cleaning uses the number of piles remaining after the click.
An already pending target is fixed; its care is not rerolled during the battle.
If no normal route is eligible, EXP remains at the threshold and the companion
stays active, so cleaning can unlock an eligible route without losing progress.

The snapshot is generated by `scripts/import-evolution-reference.py` with
BeautifulSoup 4. Download the linked guides into an HTML directory using the
`digital-pet-humulos-<guide>.html` names, and export `DIGIMON_DATA` as JSON. Run:

```sh
python3 scripts/import-evolution-reference.py --html-dir /path/to/html --catalog /path/to/catalog.json
npx biome format --write packages/digital-pet-core/src/data/evolution-reference.json
```

Source URLs and care masks are retained in the snapshot. Unmatched species and
ambiguous names are not silently converted into confirmed routes. This preserves
the initial review's limitations instead of presenting unverified connections
as valid evolution choices.


## Updated on 2026-10-15

The threshold waiting policy described above is superseded. New non-egg duels
start at 100% without a selected target. Winning adds one combat victory before
selecting from eligible normal routes using current unclean piles and per-form
victories. A win with no eligible result keeps the form and victory, shows the
no-evolution notice and clears EXP. Loss clears EXP without adding a win. Legacy
pending targets still finish their previously selected evolution.

The generated snapshot now has **1,467 normal, 230 Jogress and 201 special**
connections, including **44 normal connections with numeric victory conditions**.
Victory-only unlocks are eligible normal routes; pair, slot, permanent objective
and transformation gates remain separate. Meicoomon → Meicrackmon, for example,
requires at least 12 combat victories and can unlock on the twelfth winning duel.

Humulos battle windows such as 12–15 victories are adapted to a minimum of 12
within the current form. This game has no fixed device battle window, win ratio
or separate effort stat. Care and victories within a source alternative must both
hold; alternatives remain OR groups. Source alternatives whose care categories
are already covered by an unrestricted route do not invent a victory requirement.
Source-specific timing, effort and level remain EXP adaptations. The counter
includes adventure and evolution-duel wins, survives reserve switches and save
transfer, and resets on an actual form change. PvP wins currently do not count.

SQLite migration 10 commits the result and its unique duel identity atomically.
Browser IndexedDB commits before the result animation and uses the pending duel's
companion, form and ready timestamp to reject stale results. Transfer v3 includes
these counters and targetless duels; v1/v2 backups remain readable.
