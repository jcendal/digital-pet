# Monorepo structure

El root (`@sbugallo/opencode-vpet-workspace`) **no se publica en npm** — solo orquesta workspaces.

```
packages/
├── vpet-core/          # @sbugallo/vpet-core (privado, compartido)
│   └── src/adapters/sqlite/
├── vpet-animation/     # @sbugallo/vpet-animation (privado; solo animación prod)
├── opencode-vpet/      # @sbugallo/opencode-vpet (publicable en npm)
│   └── src/            # plugin prod + src/dev/ (dev tools con OPENCODE_VPET_DEV=1)
└── cursor-vpet/        # extensión Cursor (.vsix)
    └── src/            # extensión prod + src/dev/ (dev tools)
```

**Dev tools:** carpeta `src/dev/` por host; solo dispara APIs prod existentes. Único cambio en prod: gate mínimo en `extension.ts` / `tui.tsx`.

## Toolchain (Node + Bun)

| Herramienta | Versión fijada | Uso |
|-------------|----------------|-----|
| **Bun** `1.3.5` | `packageManager`, `engines`, Volta | install, test, build, runtime del plugin OpenCode |
| **Node** `24.11.0` | `engines`, Volta, CI | CLI publicada (`opencode-vpet`), npm publish, VSIX, host de la extensión |

```bash
volta install node@24.11.0 bun@1.3.5
```

## Commands (from repo root)

```bash
bun install
bun run check
bun run test
bun run test:persistence
bun run build
bun run --filter '@sbugallo/opencode-vpet' prepack
bun run --filter cursor-vpet package   # produces .vsix
```

## Dev tools (animaciones y escenarios)

Herramientas de desarrollo para disparar feed, actividad, evolution reveal y evolution battle sin flujos reales de agente. Código en `src/dev/`; no se incluye en declaraciones npm (`tsconfig.build.json` excluye `src/dev`).

### Cursor (`cursor-vpet`)

Activación (cualquiera de estas):

| Método | Uso |
|--------|-----|
| `vpet.devTools: true` | Setting de workspace/usuario en VS Code/Cursor |
| `CURSOR_VPET_DEV=1` | Variable de entorno |
| Extension Development Host (F5) | Modo desarrollo de la extensión |

Comando en paleta: **Cursor VPet: Dev Tools** → quick pick con Feed / Evolution Reveal / Evolution Battle.

```bash
cd packages/cursor-vpet && bun run build
# Luego F5, o instalar .vsix con vpet.devTools / CURSOR_VPET_DEV
```

### OpenCode (`opencode-vpet`)

Activación: `OPENCODE_VPET_DEV=1`. Comandos en paleta bajo categoría **VPet Dev** (feed, activity, evolution reveal, battle, defeat).

El build emite `dist/dev/attach-dev-tools.js` para que el import dinámico en `tui.tsx` funcione con el paquete compilado.

```bash
cd packages/opencode-vpet && bun run build
OPENCODE_VPET_DEV=1 opencode
```

## Publicación npm

`@sbugallo/opencode-vpet` empaqueta el JS de `vpet-core` en `dist/`.

## Cursor extension install (end users)

```bash
cd packages/cursor-vpet
bun run build
bun run package
```

## Open VSX / Marketplace (CD)

- `OVSX_PAT` — [Open VSX](https://open-vsx.org/extension/sbugallo/cursor-vpet)
- `VSCE_PAT` — VS Code Marketplace (optional)
