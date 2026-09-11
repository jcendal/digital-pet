# Plan de implementación: paquete `@sbugallo/vpet-animation`

Documento paso a paso para extraer la presentación ASCII compartida, eliminar ~1.400 LOC duplicadas entre `opencode-vpet` y `cursor-vpet`, y cerrar los gaps funcionales conocidos (`activity` en Cursor, frames `eat_*` sin usar, drift de constantes).

**Relacionado:** [`packages/cursor-vpet/docs/REFACTORING-IMPLEMENTATION-SPEC.md`](../packages/cursor-vpet/docs/REFACTORING-IMPLEMENTATION-SPEC.md) (plan general del refactor Cursor).

**Última revisión:** 2026-09-11 (código verificado en `feat/cursor-extension`).

---

## 1. Objetivo

Crear un paquete workspace **`packages/vpet-animation`** que contenga:

1. Animación idle (`MonsterAnimationController` + policies + mirror).
2. Render posicionado unificado (`renderPositionedArtwork` / `renderPositionedArtworkRows`).
3. Artworks de batalla, evolución y derrota (secuencias puras `string → string`).
4. Utilidades compartidas (`sleep`, `normalizedRandom`, `assertNever`, constantes de timing y layout).
5. Tests unitarios centralizados.

Los hosts (`opencode-vpet`, `cursor-vpet`) conservan **solo**:

- Wiring de UI (SolidJS / webview).
- Orquestación (poll loop, `sidebar-orchestrator`).
- Adapters (hooks Cursor, server hooks OpenCode, SQLite).
- Entrega de frames (`AnimationSink`, `setCustomArtwork`, `postMessage`).

---

## 2. Estado actual verificado

### 2.1 Lo que ya está hecho (no repetir)

| Área | Estado | Ubicación |
|------|--------|-----------|
| Paridad visual batalla/evolución/derrota | Hecho en ambos hosts | `tui/*-artwork.ts`, `cursor-vpet/.../presentation/*` |
| Sessions de batalla/reveal | Hecho (duplicado) | `evolution-battle-session.ts`, `evolution-reveal-session.ts` |
| Refactor sidebar Cursor | Hecho | `sidebar-orchestrator`, `sidebar-animation-host`, `sidebar-presenter`, `bootstrap/` |
| Utilidades Cursor | Hecho | `cursor-vpet/src/shared/{sleep,random,assert-never}.ts` |
| Constantes presentation | Hecho en Cursor | `shared/constants/{presentation-timing,evolution-battle,monster-artwork}.ts` |
| Tests architecture boundary Cursor | Hecho | `cursor-vpet/tests/architecture-boundary.test.ts` |
| Repository único como snapshot reader | Hecho | `bootstrap/container.ts` |
| Refresh con cola (sin recursión) | Hecho | `async-refresh-queue.ts` + orchestrator |

### 2.2 Lo que sigue duplicado (~2.800 LOC totales, ~1.400 efectivas duplicadas)

| Módulo | OpenCode | Cursor | Similitud |
|--------|----------|--------|-----------|
| `monster-animation.ts` | `src/tui/` | `src/webview/presentation/` | ~98% |
| `monster-walking-policy.ts` | idem | idem | ~100% |
| `monster-action-policy.ts` | idem | idem | ~100% |
| `monster-artwork-mirror.ts` | idem | idem | ~98% |
| `evolution-battle-artwork.ts` | idem | idem | ~99% |
| `evolution-artwork.ts` | idem | idem | ~99% |
| `defeat-artwork.ts` | idem | idem | ~99% |
| `evolution-battle-session.ts` | idem | idem | ~99% |
| `evolution-reveal-session.ts` | idem | idem | ~100% |
| Render posicionado | inline en `sidebar-card.tsx` (`artworkRows`) | `animated-artwork.ts` | Lógica equivalente |

### 2.3 Gaps funcionales abiertos

| ID | Problema | Impacto |
|----|----------|---------|
| GAP-01 | Cursor no despacha `activity` al usar el Agent | El Digimon se duerme aunque haya uso activo |
| GAP-02 | Frames `eat_1`/`eat_2` nunca se reproducen | 645 sprites con animación sin usar |
| GAP-03 | `frozen`, `gauge`, `evolutionBattlePending` no afectan idle | Comportamiento “muerto” respecto al juego |
| GAP-04 | Constantes de timing en OpenCode inline, en Cursor en `shared/` | Drift en cada cambio |
| GAP-05 | `evolution-battle-session` llama `resolveEvolutionBattleForPartner` | Mezcla presentación + persistencia |
| GAP-06 | OpenCode `prepack` solo stagea `vpet-core` | Nuevo paquete necesita mismo patrón de publish |

---

## 3. Problemas → soluciones (mapa completo)

| Problema | Solución | Fase / PR |
|----------|----------|-----------|
| Duplicación idle + artworks | Paquete `vpet-animation` | PR-A, PR-B, PR-C |
| `artworkRows` vs `animated-artwork` divergen | `positioned-artwork.ts` único | PR-A |
| Drift de constantes | `vpet-animation/constants/*` | PR-A |
| Tests duplicados en 2 hosts | Migrar a `vpet-animation/tests` | PR-A, PR-B |
| Cursor sin `activity` | `onActivity` en usage pipeline + `animationHost.dispatch` | PR-D |
| `eat_*` sin usar | Ampliar `monster-action-policy` + disparo en `activity` | PR-E |
| Session mezcla DB + visual | Separar: animation puro + orchestrator persiste | PR-C |
| OpenCode npm pack sin monorepo | `stage-vpet-animation-sources.ts` + declarations | PR-F |
| Cursor bundle VSIX | `workspace:*` dependency, Bun inlines en build | PR-B |
| API pública OpenCode expone internals | Boundary tests: no exportar `vpet-animation` | PR-G |
| Regresión visual batalla | Tests snapshot existentes antes/después | PR-C |
| `planEvolutionBattle` en artwork | Mover a `vpet-core/domain` (opcional) | PR-C opcional |

---

## 4. Arquitectura objetivo

```
┌─────────────────────────────────────────────────────────────┐
│ vpet-core                                                    │
│ dominio · persistencia · view-models · monster-frame-data   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│ vpet-animation (NUEVO, privado workspace)                    │
│                                                              │
│ idle/          monster-animation, walking-policy, action-policy│
│ render/        positioned-artwork, monster-artwork-mirror    │
│ sequences/     evolution-battle-artwork, evolution-artwork,  │
│                defeat-artwork, animation-runner              │
│ sessions/      evolution-battle-animation (visual only)      │
│                evolution-reveal-animation (visual only)      │
│ constants/     timing, layout, battle scoring                │
│ utils/         sleep, random, assert-never                     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
   ┌───────────▼──────────┐      ┌────────────▼─────────────┐
   │ opencode-vpet        │      │ cursor-vpet               │
   │ tui.tsx              │      │ sidebar-orchestrator      │
   │ sidebar-card.tsx     │      │ sidebar-animation-host    │
   │ sidebar-poll-loop    │      │ adapters/cursor/*         │
   │ server hooks         │      │ adapters/vscode/*         │
   └──────────────────────┘      └──────────────────────────┘
```

### 4.1 Reglas de dependencias (obligatorias)

```
vpet-animation  →  vpet-core (solo data + tipos; NO adapters/sqlite)
opencode-vpet   →  vpet-core, vpet-animation
cursor-vpet     →  vpet-core, vpet-animation

PROHIBIDO en vpet-animation:
  - vscode, solid-js, @opentui/*, @opencode-ai/*
  - node:fs, sql.js
  - imports desde /adapters/, /webview/, /bootstrap/ de cualquier host
```

Añadir en `cursor-vpet/tests/architecture-boundary.test.ts` (y equivalente OpenCode si aplica):

```typescript
// Escanear packages/vpet-animation/src — cero imports prohibidos
```

---

## 5. Estructura del paquete `vpet-animation`

### 5.1 Árbol de archivos

```
packages/vpet-animation/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                          # reexports públicos del paquete
│   ├── constants/
│   │   ├── monster-layout.ts             # FRAME_ROWS=8, FRAME_COLUMNS=16
│   │   ├── presentation-timing.ts        # migrar desde cursor shared
│   │   └── evolution-battle.ts           # migrar desde cursor shared
│   ├── utils/
│   │   ├── sleep.ts
│   │   ├── random.ts
│   │   └── assert-never.ts
│   ├── idle/
│   │   ├── monster-animation.ts
│   │   ├── monster-walking-policy.ts
│   │   ├── monster-action-policy.ts
│   │   └── monster-artwork-mirror.ts
│   ├── render/
│   │   └── positioned-artwork.ts         # unifica animated-artwork + artworkRows
│   ├── sequences/
│   │   ├── animation-runner.ts           # runFrameSequence (extraer de artworks)
│   │   ├── evolution-battle-artwork.ts
│   │   ├── evolution-artwork.ts
│   │   └── defeat-artwork.ts
│   └── sessions/
│       ├── evolution-battle-animation.ts # SOLO visual (sin resolveEvolutionBattle)
│       └── evolution-reveal-animation.ts
└── tests/
    ├── monster-animation.test.ts
    ├── monster-animation-actions.test.ts
    ├── monster-animation-walking.test.ts
    ├── monster-artwork-mirror.test.ts
    ├── positioned-artwork.test.ts
    ├── evolution-battle-artwork.test.ts
    ├── evolution-artwork.test.ts
    ├── defeat-artwork.test.ts
    ├── evolution-battle-animation.test.ts
    └── evolution-reveal-animation.test.ts
```

### 5.2 `package.json`

```json
{
  "name": "@sbugallo/vpet-animation",
  "version": "0.2.0-dev.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "24.11.0",
    "bun": "1.3.5"
  },
  "dependencies": {
    "@sbugallo/vpet-core": "workspace:*"
  },
  "exports": {
    "./idle/*": "./src/idle/*",
    "./render/*": "./src/render/*",
    "./sequences/*": "./src/sequences/*",
    "./sessions/*": "./src/sessions/*",
    "./constants/*": "./src/constants/*",
    "./utils/*": "./src/utils/*"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "1.3.14",
    "typescript": "5.9.3"
  }
}
```

### 5.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "target": "ESNext",
    "lib": ["ESNext"],
    "types": ["bun"],
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

### 5.4 Registrar workspace

En el root `package.json`, el workspace `packages/*` ya incluye carpetas nuevas automáticamente.

Añadir al script `check` del root:

```json
"bun run --filter '@sbugallo/vpet-animation' typecheck"
```

Y al `test`:

```json
"bun run --filter '@sbugallo/vpet-animation' test"
```

---

## 6. Plan de implementación por fases

Cada fase = 1 PR mergeable. **No mezclar fases** para poder revertir con granularidad.

```
PR-A (scaffold + idle + render)
  ↓
PR-B (migrar hosts a vpet-animation idle)
  ↓
PR-C (artworks + sessions visuales)
  ↓
PR-D (activity en Cursor)
  ↓
PR-E (eat + contexto opcional)
  ↓
PR-F (build OpenCode publish)
  ↓
PR-G (limpieza + docs)
```

---

## 7. PR-A — Scaffold + idle + render (4–6 h)

### 7.1 Pasos

1. **Crear carpeta** `packages/vpet-animation/` con `package.json` y `tsconfig.json`.

2. **Copiar utilidades** desde `cursor-vpet/src/shared/`:
   - `sleep.ts` → `src/utils/sleep.ts`
   - `random.ts` → `src/utils/random.ts`
   - `assert-never.ts` → `src/utils/assert-never.ts`

3. **Copiar constantes** desde `cursor-vpet/src/shared/constants/`:
   - `monster-artwork.ts` → `src/constants/monster-layout.ts` (renombrar exports a `MONSTER_FRAME_ROWS`, `MONSTER_FRAME_COLUMNS`)
   - `presentation-timing.ts` → `src/constants/presentation-timing.ts`
   - `evolution-battle.ts` → `src/constants/evolution-battle.ts`

4. **Mover idle** (usar versión Cursor como base — ya usa shared utils):
   - `cursor-vpet/src/webview/presentation/monster-*.ts` → `vpet-animation/src/idle/`
   - Actualizar imports internos a `@sbugallo/vpet-animation/...` o paths relativos dentro del paquete.

5. **Crear `positioned-artwork.ts`** unificando:
   - `cursor-vpet/src/webview/presentation/animated-artwork.ts`
   - `opencode-vpet/src/tui/sidebar-card.tsx` (`positionedOutput` + `artworkRows`)

   API objetivo:

   ```typescript
   export const renderPositionedArtworkRows = (
     animation: MonsterAnimationOutput | MonsterAnimationResult,
     viewportWidth: number,
   ): readonly string[]

   export const renderPositionedArtwork = (
     animation: MonsterAnimationOutput | MonsterAnimationResult,
     viewportWidth: number,
   ): string
   ```

   **Test de equivalencia:** mismo input que `monster-animation.test.ts` + width 80 → output idéntico al de ambos hosts antes del cambio.

6. **Migrar tests** (copiar, ajustar imports):
   - `cursor-vpet/tests/monster-animation.test.ts`
   - `opencode-vpet/tests/monster-animation.test.ts` (fusionar en uno)
   - `opencode-vpet/tests/monster-animation-actions.test.ts`
   - `opencode-vpet/tests/monster-animation-walking.test.ts`
   - `opencode-vpet/tests/monster-artwork-mirror.test.ts`
   - Nuevo: `positioned-artwork.test.ts` con casos de blank, frame left/right, unavailable, custom width

7. **Ejecutar verificación:**

   ```bash
   cd packages/vpet-animation && bun test && bun run typecheck
   ```

### 7.2 Criterios de aceptación PR-A

- [ ] Paquete existe y pasa `bun test` de forma aislada.
- [ ] Cero dependencias de host en `src/`.
- [ ] `renderPositionedArtworkRows` produce mismas filas que `sidebar-card.tsx` para fixtures conocidos.
- [ ] Hosts **aún no migrados** (sin cambio de comportamiento en producto).

---

## 8. PR-B — Migrar hosts al idle compartido (1–2 días)

### 8.1 cursor-vpet

1. Añadir dependencia en `package.json`:

   ```json
   "@sbugallo/vpet-animation": "workspace:*"
   ```

2. **Eliminar** (tras migrar imports):
   - `src/webview/presentation/monster-animation.ts`
   - `src/webview/presentation/monster-walking-policy.ts`
   - `src/webview/presentation/monster-action-policy.ts`
   - `src/webview/presentation/monster-artwork-mirror.ts`
   - `src/webview/presentation/animated-artwork.ts`

3. **Actualizar imports** en:
   - `sidebar-animation-host.ts` → `@sbugallo/vpet-animation/render/positioned-artwork.ts`
   - `sidebar-presenter.ts` → tipos desde `@sbugallo/vpet-animation/idle/monster-animation.ts`
   - Tests que importaban presentation local.

4. **Mantener** en `cursor-vpet/src/shared/constants/` solo lo host-specific (`sidebar-ui.ts`, `sqlite.ts`, `cursor.ts`). Eliminar duplicados ya movidos a vpet-animation.

5. **Actualizar** `architecture-boundary.test.ts`:
   - `FORBIDDEN_PRESENTATION_IMPORTS` ya no aplica a archivos eliminados.
   - Añadir scan de `vpet-animation` sin imports prohibidos.

6. **Build VSIX:**

   ```bash
   cd packages/cursor-vpet && bun run build && bun run package
   ```

   Bun bundleará `vpet-animation` dentro de `dist/extension.js`.

### 8.2 opencode-vpet

1. Añadir `"@sbugallo/vpet-animation": "workspace:*"` en dependencies.

2. **Eliminar** `src/tui/monster-*.ts` (4 archivos).

3. **Refactorizar `sidebar-card.tsx`:**
   - Eliminar `positionedOutput`, `artworkRows`, imports de mirror local.
   - Importar `renderPositionedArtworkRows` desde `@sbugallo/vpet-animation/render/positioned-artwork.ts`.
   - Importar tipos desde `@sbugallo/vpet-animation/idle/monster-animation.ts`.

4. **Refactorizar `tui.tsx`:**
   - `MonsterAnimationController` desde `@sbugallo/vpet-animation/idle/monster-animation.ts`.

5. **Eliminar tests migrados** de `opencode-vpet/tests/` (monster-animation*, monster-artwork-mirror) o dejarlos como smoke que importan el paquete.

6. **Verificar build:**

   ```bash
   cd packages/opencode-vpet && bun run build && bun test
   ```

7. **Verificar port-boundary** (`tests/port-boundary.test.ts`):
   - `import("opencode-vpet/tui/monster-animation")` debe seguir **fallando**.
   - Animación bundled en `dist/tui.js` sin export pública del módulo.

### 8.3 Criterios de aceptación PR-B

- [ ] No quedan copias de `monster-animation.ts` en hosts.
- [ ] `bun test` pasa en los 3 paquetes.
- [ ] `bun run check` en root pasa.
- [ ] `bun run build` (root) pasa.
- [ ] Sidebar Cursor y TUI renderizan idle igual (tests composición / sidebar-card).

---

## 9. PR-C — Artworks + sessions visuales (2–3 días)

### 9.1 Extraer `animation-runner.ts`

Patrón repetido en evolution/defeat/battle:

```typescript
export type FrameSequenceOptions = {
  readonly durationMs: number
  readonly tickMs: number
  readonly render: (progress: number, tick: number) => string
  readonly onFrame: (artwork: string) => Promise<void>
  readonly preDelayMs?: number
}

export const runFrameSequence = async (options: FrameSequenceOptions): Promise<void> => {
  if (options.preDelayMs !== undefined && options.preDelayMs > 0) {
    await sleep(options.preDelayMs)
  }
  const steps = Math.max(1, Math.ceil(options.durationMs / options.tickMs))
  for (let step = 0; step <= steps; step += 1) {
    await options.onFrame(options.render(step / steps, step))
    if (step < steps) await sleep(options.tickMs)
  }
}
```

Refactorizar `evolution-artwork.ts`, `defeat-artwork.ts`, partes de `evolution-battle-artwork.ts` para usar `runFrameSequence` donde aplique.

### 9.2 Mover artworks a `vpet-animation/src/sequences/`

1. Copiar desde Cursor `presentation/` (versión con constantes centralizadas).
2. Migrar tests:
   - `evolution-battle-artwork.test.ts`
   - `evolution-artwork.test.ts`
   - `defeat-artwork.test.ts`
3. Ejecutar tests **antes** de tocar hosts y guardar outputs como baseline.

### 9.3 Separar sessions: visual vs persistencia

**Problema GAP-05:** hoy `runEvolutionBattleSession` llama `resolveEvolutionBattleForPartner`.

**Solución:**

| Módulo nuevo | Responsabilidad |
|--------------|-----------------|
| `evolution-battle-animation.ts` | Intro BATTLE + combate + reveal visual win + defeat visual. Devuelve `EvolutionBattleOutcome`. |
| `evolution-reveal-animation.ts` | Solo morph entre dos sprites (sin DB). |

**En cada host (orchestrator / tui.tsx):**

```typescript
const outcome = await runEvolutionBattleAnimation(snapshot, viewportWidth, deps)
const result = resolveEvolutionBattleForPartner(repository, outcome === "player", catalog, now)
await deps.onResolved?.(result)
```

Pasos:

1. Crear `runEvolutionBattleAnimation` extrayendo la parte visual de `evolution-battle-session.ts`.
2. Renombrar `runEvolutionRevealSession` → `runEvolutionRevealAnimation` en vpet-animation.
3. Dejar en hosts un thin wrapper `runEvolutionBattleSession` de ~15 líneas que compone visual + persistencia, **o** inline en orchestrator.
4. Eliminar duplicados en `tui/` y `cursor-vpet/.../presentation/`.

### 9.4 Opcional: `planEvolutionBattle` → vpet-core

Si los tests de dominio lo permiten:

```
vpet-core/src/domain/evolution-battle-plan.ts
```

Ambos artworks importan desde core. Reduce lógica de juego en presentation.

### 9.5 Criterios de aceptación PR-C

- [ ] Tests artwork pasan sin cambio de output (comparar strings clave: BATTLE banner, fireball chars, refuse en defeat).
- [ ] `evolution-battle-artwork.ts` < 450 líneas (objetivo; runner reduce duplicación).
- [ ] `resolveEvolutionBattleForPartner` solo en hosts o vpet-core, **no** en vpet-animation.
- [ ] Ambos hosts usan las mismas funciones del paquete.

---

## 10. PR-D — `activity` en Cursor (4–8 h)

**Resuelve GAP-01.**

### 10.1 Extender `SidebarAnimationHost`

En `sidebar-animation-host.ts`, exportar:

```typescript
export type SidebarAnimationHost = {
  // ...existente
  notifyActivity(): void
}

// implementación:
notifyActivity(): void {
  if (presentationBlocked) return
  animation.dispatch({ kind: "activity" })
  void postCurrentFrame()
}
```

### 10.2 Extender usage pipeline

En `cursor-usage-event-source.ts`:

```typescript
export type CursorUsageEventSourceOptions = {
  // ...
  readonly onActivity?: () => void
}

// En handleBeforeSubmit (actividad temprana):
options.onActivity?.()

// Tras applyUsage con result.kind === "applied":
options.onActivity?.()
```

### 10.3 Conectar en `extension.ts`

```typescript
createUsagePipeline(container.repository, (result) => {
  container.sidebarProvider.notifyActivity() // nuevo método en provider
  if (result.kind === "applied" && result.evolution !== undefined) {
    container.sidebarProvider.queueEvolutionReveal(result.evolution)
  }
  container.refreshSidebar()
}, ...)
```

### 10.4 Tests

- `sidebar-animation-host.test.ts`: `notifyActivity` despierta de sleep (mock `nowMs`).
- `cursor-usage-event-source.test.ts`: mock confirma `onActivity` en beforeSubmit y applied.

### 10.5 Criterios de aceptación PR-D

- [ ] Tras hook de usage, partner dormido vuelve a `walking`.
- [ ] `#lastActivityMs` se resetea (no duerme durante uso activo del Agent).
- [ ] OpenCode sin cambios (ya tenía `activity`).

---

## 11. PR-E — `eat` + contexto de juego (1–2 días, opcional)

**Resuelve GAP-02 y GAP-03.**

### 11.1 Ampliar `monster-action-policy.ts`

```typescript
const EAT_CLIP: CosmeticActionClip = ["eat_1", "eat_2"]

export const resolveCosmeticActions = (sprite, catalog) => {
  // ...existente
  if (catalog.get(sprite, "eat_1") && catalog.get(sprite, "eat_2")) {
    actions.push(EAT_CLIP)
  }
  // refuse donde exista (130 sprites)
}
```

### 11.2 Clip `eat` tras tokens

En `MonsterAnimationController`, nuevo evento opcional:

```typescript
| { readonly kind: "tokens_applied" }
```

Handler: si estado es `walking` | `sleeping`, transicionar a clip `eat` (2 fases) antes de volver a walk.

**Alternativa más simple:** en `activity`, con probabilidad o siempre, forzar clip eat en lugar de solo resetear timer.

### 11.3 `AnimationContext` (fase 2 de PR-E)

```typescript
export type MonsterAnimationContext = {
  readonly frozen: boolean
  readonly evolutionBattlePending: boolean
  readonly gaugeRatio: number // 0..1
}
```

Nuevo evento `context_changed`. Comportamientos:

| Condición | Efecto |
|-----------|--------|
| `frozen` | Estado `frozen` → frame `sleep_1` fijo, sin walk |
| `evolutionBattlePending` | Pose `attack` cuando idle en borde |
| `gaugeRatio > 0.8` | Pesar `happy`/`attack` en `selectCosmeticAction` |

Hosts despachan `context_changed` en cada `syncPartner` / refresh del presenter.

### 11.4 Criterios de aceptación PR-E

- [ ] Test: sprite con eat frames reproduce `eat_1`→`eat_2` tras `tokens_applied` o `activity`.
- [ ] `frozen` detiene movimiento en ambos hosts.
- [ ] Sin regresión en tests idle existentes.

---

## 12. PR-F — Build y publish OpenCode (1 día)

**Resuelve GAP-06.**

OpenCode publica en npm **sin** workspace alrededor. Hoy usa:

1. `stage-vpet-core-sources.ts` → `build/vpet-core-src/`
2. `bun build` bundlea TS
3. `tsc -p tsconfig.vpet-core-declarations.json` → `dist/vpet-core/`
4. `rewrite-vpet-core-declarations.ts` reescribe imports en `.d.ts`
5. `strip-workspace-deps.ts` elimina `workspace:*` del package.json publicado

### 12.1 Crear `stage-vpet-animation-sources.ts`

```typescript
// packages/opencode-vpet/scripts/stage-vpet-animation-sources.ts
// Copiar ../vpet-animation/src → build/vpet-animation-src
// (mismo patrón que stage-vpet-core-sources.ts)
```

### 12.2 Actualizar `scripts/build.ts`

```typescript
// Al inicio, después de stage vpet-core:
Bun.spawnSync(["bun", "scripts/stage-vpet-animation-sources.ts"])
```

Bun resolverá `@sbugallo/vpet-animation` en dev; en CI publish sin monorepo, el staging garantiza fuentes.

### 12.3 Declarations (si hace falta)

Si algún `.d.ts` publicado importa `@sbugallo/vpet-animation`:

1. Crear `tsconfig.vpet-animation-declarations.json` (espejo de vpet-core).
2. Extender `rewrite-vpet-core-declarations.ts` → `rewrite-workspace-declarations.ts` con patrón para ambos paquetes.

**Nota:** si `vpet-animation` queda totalmente inlined en `dist/tui.js` y no aparece en tipos públicos, puede no hacer falta emitir `dist/vpet-animation/`.

### 12.4 Verificación publish

```bash
cd packages/opencode-vpet
bun run prepack
npm pack --dry-run
# Ejecutar tests/port-boundary.test.ts contra el tarball
bun run postpack
```

### 12.5 cursor-vpet

Solo confirmar que `bun run build` incluye vpet-animation en el bundle. No hay publish npm.

### 12.6 Criterios de aceptación PR-F

- [ ] `npm pack` de opencode-vpet funciona sin `../vpet-animation` en disco (solo staged).
- [ ] `port-boundary.test.ts` pasa.
- [ ] VSIX de cursor-vpet instala y anima.

---

## 13. PR-G — Limpieza y documentación (2–4 h)

1. Actualizar `docs/monorepo.md` con `vpet-animation`.
2. Actualizar `REFACTORING-IMPLEMENTATION-SPEC.md` §3.3 y progreso PR-3.
3. Eliminar reexports muertos en hosts.
4. Añadir `packages/vpet-animation/README.md` (API mínima, reglas de dependencias).
5. Root `bun run test` y `bun run check` verdes.

---

## 14. Guía de migración de imports

### Host → paquete

| Antes (cursor) | Después |
|----------------|---------|
| `../presentation/monster-animation.ts` | `@sbugallo/vpet-animation/idle/monster-animation.ts` |
| `../presentation/animated-artwork.ts` | `@sbugallo/vpet-animation/render/positioned-artwork.ts` |
| `../presentation/evolution-battle-artwork.ts` | `@sbugallo/vpet-animation/sequences/evolution-battle-artwork.ts` |
| `../../shared/constants/presentation-timing.ts` | `@sbugallo/vpet-animation/constants/presentation-timing.ts` |
| `../../shared/sleep.ts` | `@sbugallo/vpet-animation/utils/sleep.ts` |

| Antes (opencode) | Después |
|------------------|---------|
| `./monster-animation.ts` | `@sbugallo/vpet-animation/idle/monster-animation.ts` |
| `./monster-artwork-mirror.ts` | `@sbugallo/vpet-animation/idle/monster-artwork-mirror.ts` |
| `artworkRows` en sidebar-card | `renderPositionedArtworkRows` |

---

## 15. Estrategia de tests

### 15.1 Durante la migración

1. **Baseline:** ejecutar todos los tests artwork en ambos hosts y guardar salida.
2. **Por PR:** tests viven en `vpet-animation`; hosts mantienen solo integration tests (orchestrator, tui-composition, port-boundary).
3. **No duplicar:** eliminar tests idénticos del host cuando el test vive en vpet-animation.

### 15.2 Tests que permanecen en hosts

| Paquete | Tests |
|---------|-------|
| cursor-vpet | `sidebar-orchestrator`, `sidebar-animation-host`, `architecture-boundary`, `cursor-usage-event-source`, persistence |
| opencode-vpet | `tui-composition`, `port-boundary`, `sidebar-poll-loop`, server hooks, persistence |
| vpet-animation | Todo lo que renderiza strings o avanza state machine |

### 15.3 Comando de verificación global

```bash
# Desde root, tras cada PR:
bun install
bun run check
bun run test
bun run test:persistence
bun run build
```

---

## 16. Checklist de regresión manual

### Cursor

- [ ] Abrir sidebar VPet: partner camina.
- [ ] Redimensionar panel: sprite respeta bordes.
- [ ] Llenar gauge → batalla automática (intro BATTLE parpadea).
- [ ] Ganar → animación evolución → mensaje victoria.
- [ ] Perder → animación derrota (refuse/injured).
- [ ] Tras PR-D: usar Agent → Digimon no se queda dormido.
- [ ] Tras PR-E: usar Agent → clip eat visible.
- [ ] Freeze: texto "(frozen)"; tras PR-E sprite quieto.

### OpenCode TUI

- [ ] Sidebar monta partner.
- [ ] Activity en mensajes despierta partner.
- [ ] Batalla pendiente anima igual que Cursor.
- [ ] Comandos spawn/freeze/set sin recrear TUI.
- [ ] `npm pack` + consumer test (port-boundary) pasa.

---

## 17. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Regresión visual sutil en posicionamiento | Media | `positioned-artwork.test.ts` con fixtures de width 32, 58, 80 |
| OpenCode pack sin monorepo | Alta si no se hace PR-F | Staging script obligatorio antes de merge PR-C |
| Bundle size VSIX crece | Baja | vpet-animation es TS puro, ~same bytes que duplicado actual |
| Drift post-migración | Baja si un solo paquete | CI: fallar si existen `monster-animation.ts` en hosts |
| Session split rompe battle flow | Media | Test integration `evolution-battle-session` en host con mock repository |
| `performance.now` en constructor default | Baja | Mantener inyección `nowMs` en hosts (Cursor ya usa `() => performance.now()`) |

### Guardrail CI (añadir en PR-B)

Script `scripts/assert-no-duplicate-animation.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
if find packages/opencode-vpet/src/tui packages/cursor-vpet/src/webview/presentation \
  -name 'monster-animation.ts' 2>/dev/null | grep -q .; then
  echo "Duplicate monster-animation.ts found in hosts"
  exit 1
fi
```

---

## 18. Orden de ejecución recomendado (resumen ejecutivo)

| # | PR | Duración | Bloquea |
|---|-----|----------|---------|
| 1 | PR-A Scaffold + idle | 0.5–1 día | — |
| 2 | PR-B Migrar hosts idle | 1–2 días | PR-A |
| 3 | PR-C Artworks + sessions | 2–3 días | PR-B |
| 4 | PR-F Build OpenCode | 1 día | PR-C (puede paralelizarse con PR-D) |
| 5 | PR-D Activity Cursor | 0.5 día | PR-B |
| 6 | PR-E Eat + context | 1–2 días | PR-B, PR-D |
| 7 | PR-G Docs + cleanup | 0.5 día | Todo |

**Total estimado:** 7–11 días de trabajo enfocado.

---

## 19. Lo que NO hacer

1. **No** meter adapters SQLite en `vpet-animation`.
2. **No** exportar `vpet-animation` desde la API pública de `opencode-vpet` (mantener boundary tests).
3. **No** mezclar PR de artworks con PR de activity (facilita bisect).
4. **No** duplicar constantes en hosts tras PR-A (importar solo desde vpet-animation).
5. **No** llamar `resolveEvolutionBattleForPartner` desde dentro del paquete de animación.
6. **No** añadir dependencia de SolidJS/OpenTUI al paquete compartido.
7. **No** eliminar tests de host antes de que existan equivalentes en vpet-animation.

---

## 20. Definición de “hecho” global

- [ ] Un solo `monster-animation.ts` en el monorepo (dentro de `vpet-animation`).
- [ ] Un solo conjunto de tests artwork/evolution/defeat en `vpet-animation`.
- [ ] `bun run check && bun run test && bun run build` verdes en root.
- [ ] OpenCode `prepack` / `port-boundary` verdes.
- [ ] Cursor VSIX build e install OK.
- [ ] Cursor despacha `activity` en usage (PR-D).
- [ ] Documentación actualizada (`monorepo.md`, este doc marcado como implementado).
- [ ] Cero archivos `monster-*.ts` en `cursor-vpet/.../presentation/` ni `opencode-vpet/src/tui/` (salvo reexports temporales con ticket).

---

## 21. Apéndice: diff real entre hosts hoy

Las únicas diferencias significativas entre copias (verificado con `diff -u`):

| Archivo | Diferencia |
|---------|------------|
| `monster-animation.ts` | Cursor importa `assertNever`, `MONSTER_SLEEP_AFTER_MS`; OpenCode inline |
| `monster-walking-policy.ts` | Cursor importa `normalizedRandom` de shared |
| `evolution-battle-session.ts` | OpenCode exporta `DEFAULT_BATTLE_ARTWORK_WIDTH`; orden imports |
| `evolution-battle-artwork.ts` | Cursor importa constantes de `shared/`; OpenCode constantes inline |
| `sidebar-card.tsx` | Lógica `artworkRows` duplicada vs `animated-artwork.ts` |

**Conclusión:** la extracción es mecánica; el riesgo está en build/publish y en no romper tests de integración, no en reconciliar lógica divergente.
