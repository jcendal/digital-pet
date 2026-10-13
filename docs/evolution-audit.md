# Evolution catalogue audit

Reviewed on 2026-10-13 against [Digitama Hatchery / Humulos](https://humulos.com/digimon/).

## Finding

The catalogue is a combined graph of species connections, rather than a faithful
simulation of one device's evolution trees. It does not store a connection's
device, normal-evolution/Jogress distinction, or additional requirements.
`pickEvolutionTarget` chooses uniformly from every outgoing connection when the
experience threshold is reached. A connection that exists in a guide therefore
does not imply that the game's way of activating it matches that guide.

No evolution rules or existing saves were changed by this review.

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
