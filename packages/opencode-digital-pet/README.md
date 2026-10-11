<div align="center">
  <img src="https://raw.githubusercontent.com/jcendal/digital-pet/main/assets/branding/logo.png" alt="OpenCode Digital Pet logo" width="160" style="image-rendering: pixelated">
  <h1>OpenCode Digital Pet</h1>
  <p>A Digimon companion that evolves as you use OpenCode.</p>
</div>

Your partner grows with your OpenCode sessions. Hatch an egg, discover branching
evolutions, collect Digimon in the Dex, and revisit past companions in History.
Progress is shared across your sessions and with Cursor Digital Pet on the same
computer.

![Illustrative OpenCode partner, Dex and history views](https://raw.githubusercontent.com/jcendal/digital-pet/main/assets/screenshots/digital-pet-overview.png)

## Quick start

You need **OpenCode 1.18.10 or newer** and **Node.js 24.11.0 or newer** for the
installer.

1. Install the plugin:

   ```sh
   npx @jcendal/opencode-digital-pet init
   ```

2. Restart OpenCode.
3. Run `/digital-pet-spawn` to hatch your first partner.

## Evolution

Completed assistant messages give your partner experience. Work in concurrent
sessions contributes to the same companion. When its gauge fills, it evolves
along one of its available branches and begins progressing toward the next stage.

Use `/digital-pet-freeze` to pause growth and `/digital-pet-unfreeze` to resume.
Usage while frozen does not count toward evolution.

There are **650 Digimon** to discover, with evolution lines from the original V-Pets.

## Commands

| Command | What it does |
| --- | --- |
| `/digital-pet-spawn` | Starts a new egg. |
| `/digital-pet-freeze` | Pauses progression. |
| `/digital-pet-unfreeze` | Resumes progression. |
| `/digital-pet-set <id>` | Selects a Digimon by catalog ID. |
| `/digital-pet-dex` | Opens your Dex. |
| `/digital-pet-history` | Opens current and past generations. |

Selecting a Digimon with `/digital-pet-set` does not count toward Dex completion.
The [partner catalog](https://github.com/jcendal/digital-pet/blob/main/packages/opencode-digital-pet/docs/partners.md)
lists the available IDs.

## Update

```sh
npx @jcendal/opencode-digital-pet update
```

Restart OpenCode afterward. If you used the older `opencode-vpet` plugin, remove
its registration from your OpenCode configuration to avoid loading both.

## Settings

Edit `opencode-digital-pet.json` to configure notifications, Digimon names, and
evolution speed.

| Platform | Settings file |
| --- | --- |
| macOS / Linux / WSL | `~/.config/opencode-digital-pet.json` |
| Windows | `%APPDATA%\opencode-digital-pet.json` |

| Setting | Purpose |
| --- | --- |
| `notifications` | Turn notifications on or off. |
| `language` | Use Japanese (`jp`) or English (`en`) Digimon and stage names. |
| `stageThresholds` | Set the experience required for each evolution stage. |

Default configuration:

```json
{
  "notifications": true,
  "language": "jp",
  "stageThresholds": {
    "egg": 5000000,
    "babyI": 10000000,
    "babyII": 20000000,
    "child": 40000000,
    "adult": 75000000,
    "perfect": 125000000,
    "ultimate": 200000000,
    "superUltimate": 300000000
  }
}
```

The interface supports English, Korean, Spanish, and Galician and follows your
system language. Set `DIGITAL_PET_LANGUAGE` to `en`, `ko`, `es`, or `gl` to choose
one explicitly. This is separate from the Digimon naming setting.

An existing `opencode-vpet.json` remains in use until you create the new settings file.

## Storage

Your companion, Dex, and History are saved locally in `pet.db`. Back up this file
to keep a copy of your progress.

| Platform | Save file |
| --- | --- |
| macOS | `~/Library/Application Support/opencode-digital-pet/pet.db` |
| Linux / WSL | `~/.local/share/opencode-digital-pet/pet.db` |
| Windows | `%APPDATA%\opencode-digital-pet\pet.db` |

An existing `opencode-vpet/pet.db` continues to be used if the new save does not exist.

## Help and contributions

Report issues or suggest features in the [repository](https://github.com/jcendal/digital-pet/issues).
Development guidance is in [CONTRIBUTING.md](https://github.com/jcendal/digital-pet/blob/main/CONTRIBUTING.md).

## Credits and license

Maintained by [Jorge Cendal](https://github.com/jcendal), with
[Sergio Bugallo](https://github.com/sbugallo) as original author and contributor.

Licensed under [Apache 2.0](LICENSE). Sprites were derived from
[sundeth/omnipet](https://github.com/sundeth/omnipet/tree/main) and
[Tortoiseshel's Full Color Digimon Dot Sprites post](https://withthewill.net/threads/full-color-digimon-dot-sprites.25843/),
then edited for this project.
