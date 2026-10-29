# Evolution gameplay design evidence

See the [implementation plan](../../evolution-gameplay-plan.md) for the remaining
work and [data sources](../../data-sources.md) for imported artwork and rule
adaptations. Captures below use isolated browser test saves and do not modify a
real player's save. Only the screenshots referenced below are retained under
`assets/design/`; superseded captures and the interactive preview have been removed.

## Implemented interface

These are actual Chromium captures of the implemented interface from 2026-10-14
and 2026-10-16.
The pet retains its existing layout with a circular reserve portrait below the
name. Team is second in Dex / Team / History, with actions at the bottom. Egg
selection lives in New Journey. Regional stars remain the public boss-win signal.

| View | Evidence |
| --- | --- |
| Quick switch below the name | [Reserve portrait](../../../assets/design/evolution-gameplay/regional-eggs/companion-switch-face-390.png), [reserve egg](../../../assets/design/evolution-gameplay/regional-eggs/companion-switch-390.png) |
| Care and victories alongside EXP | [390 px](../../../assets/design/attack-projectiles/pet-indicators-390.png), [320 px](../../../assets/design/attack-projectiles/pet-indicators-320.png) |
| Dex Team tab with bottom actions | [390 px](../../../assets/design/evolution-gameplay/regional-eggs/team-390.png), [320 px](../../../assets/design/evolution-gameplay/regional-eggs/team-320.png), [desktop](../../../assets/design/evolution-gameplay/regional-eggs/team-desktop.png) |
| New Journey egg carousel | [390 px](../../../assets/design/evolution-gameplay/regional-eggs/egg-carousel-390.png) |
| Region navigation | [Next / All Regions](../../../assets/design/evolution-gameplay/refined/regions-navigation-390.png) |
| Regions ordered by difficulty | [390 px](../../../assets/design/evolution-gameplay/implemented/regions-difficulty-390.png) |
| Boss tiers | [Easy](../../../assets/design/evolution-gameplay/implemented/bosses-easy-390.png), [Hard](../../../assets/design/evolution-gameplay/implemented/bosses-hard-390.png) |

Chromium and Safari tests cover team switching, egg selection, slot previews,
stale/locked/busy actions, transfers, regional difficulty and legacy boss stars.

## Regional Digitamas

Ten distinct eggs were selected after visually reviewing all 44 Omnipet designs.
The village egg starts available; each of the other nine unlocks through that
region's boss victories. These are authored game assignments; the source supplies
artwork, not regional membership or hatch rules.

[Selection board with original color and LCD artwork](../../../assets/design/evolution-gameplay/regional-eggs/selection.png)

[Unlocked Metal Empire egg](../../../assets/design/evolution-gameplay/regional-eggs/regional-machine-egg-390.png)

## Threshold evolution duels

A winning duel with no eligible route keeps the companion, retains the victory
and resets EXP. Meicoomon's third win can unlock Meicrackmon in that same duel.
Chromium and Safari cover both cases, including legacy final forms. The notice
capture dates from 2026-10-15; current requirement captures use the revised
victory thresholds and pixel indicators.

[Win without an eligible evolution](../../../assets/design/evolution-gameplay/evolution-duels/no-evolution-390.png)

[Care and combat requirements in the Dex](../../../assets/design/attack-projectiles/care-and-combat-indicators-390.png)

## Pending interface references

Recruitment slot selection and manual fusion are still pending. The retained
screens below are design references, not screenshots of implemented features.
Use their content inside the existing game navigation; the prototype's screen
selector and companion/egg/achievement redesigns were rejected.

| Pending screen | Retained design |
| --- | --- |
| Recruitment slot selection | [390 px](../../../assets/design/evolution-gameplay/proposed/recruitment-390.png) |
| Manual fusion | [390 px](../../../assets/design/evolution-gameplay/proposed/fusion-390.png), [confirmation](../../../assets/design/evolution-gameplay/proposed/fusion-confirmation-390.png) |
