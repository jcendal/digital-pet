import { describe, expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { COMBAT_STATS } from "../src/data/combat-stats.ts"
import { COMBAT_POLICY, hitProbability, planCombat, validateCombatStats } from "../src/domain/combat.ts"

const neutral = { strength: 50, evasion: 50 }
describe("shared combat rules", () => {
  test("equal opposed scores are fair; accuracy increases with strength and decreases with evasion", () => {
    expect(hitProbability(neutral, neutral)).toBe(0.5)
    expect(hitProbability({ strength: 70, evasion: 50 }, neutral)).toBeCloseTo(0.69, 2)
    for (let score = 1; score <= 100; score++) {
      expect(hitProbability({ strength: score, evasion: 50 }, neutral)).toBeGreaterThanOrEqual(
        hitProbability({ strength: score - 1, evasion: 50 }, neutral),
      )
      expect(hitProbability(neutral, { strength: 50, evasion: score })).toBeLessThanOrEqual(
        hitProbability(neutral, { strength: 50, evasion: score - 1 }),
      )
    }
    expect(hitProbability({ strength: 100, evasion: 0 }, { strength: 0, evasion: 0 })).toBe(COMBAT_POLICY.maximum)
    expect(hitProbability({ strength: 0, evasion: 0 }, { strength: 0, evasion: 100 })).toBe(COMBAT_POLICY.minimum)
  })
  test("all 650 species have explicit immutable stats within 0–100", () => {
    expect(COMBAT_STATS.size).toBe(DIGIMON_CATALOG.nodes.length)
    for (const node of DIGIMON_CATALOG.nodes) {
      expect(COMBAT_STATS.has(node.id)).toBe(true)
      expect(Object.isFrozen(node.combatStats)).toBe(true)
      expect(validateCombatStats(node.combatStats)).toEqual(node.combatStats)
    }
    for (const value of [-1, 101, NaN, Infinity, 1.5])
      expect(() => validateCombatStats({ strength: value, evasion: 50 })).toThrow()
  })
  test("each hit follows its own roll and the first side is randomized", () => {
    const player = planCombat(neutral, neutral, () => 0)
    expect(player.outcome).toBe("player")
    expect(player.shots).toHaveLength(5)
    expect(player.shots.every((shot) => shot.hit)).toBe(true)
    let call = 0
    const opponent = planCombat(neutral, neutral, () => (call++ === 0 ? 0.9 : 0))
    expect(opponent.outcome).toBe("opponent")
    expect(opponent.shots[0]?.shooter).toBe("opponent")
    const draw = planCombat(neutral, neutral, () => 0.99)
    expect(draw.outcome).toBe("draw")
    expect(draw.shots).toHaveLength(COMBAT_POLICY.maxShots)
    expect(draw.shots.every((shot) => !shot.hit)).toBe(true)
    expect(() => planCombat(neutral, neutral, () => 1)).toThrow()
  })
  test("early forms have individual profiles and modest advantages within their stage", () => {
    for (const [stage, strength, evasion] of [
      [1, 25, 35],
      [2, 35, 40],
    ] as const) {
      const forms = DIGIMON_CATALOG.nodes.filter((node) => node.stage === stage)
      const profiles = forms.map((node) => node.combatStats)
      expect(new Set(profiles.map((stats) => `${stats.strength}:${stats.evasion}`)).size).toBe(forms.length)
      for (const stats of profiles) {
        expect(Math.abs(stats.strength - strength)).toBeLessThanOrEqual(7)
        expect(Math.abs(stats.evasion - evasion)).toBeLessThanOrEqual(7)
        for (const opponent of profiles)
          expect(Math.abs(hitProbability(stats, opponent) - hitProbability(opponent, stats))).toBeLessThan(0.13)
      }
      expect(Math.abs(profiles.reduce((sum, stats) => sum + stats.strength, 0) / forms.length - strength)).toBeLessThan(
        3,
      )
      expect(Math.abs(profiles.reduce((sum, stats) => sum + stats.evasion, 0) / forms.length - evasion)).toBeLessThan(3)
    }
  })
  test("familiar starters get a small edge while attack and evasion specialists retain their strengths", () => {
    const stats = (id: string) => {
      const node = DIGIMON_CATALOG.byId.get(id)
      if (!node) throw new Error(`Missing balance fixture ${id}`)
      return node.combatStats
    }
    for (const [stage, familiar] of [
      [1, ["1-002", "1-017", "1-018", "1-024"]], // Botamon, Poyomon, Punimon, Yuramon
      [2, ["2-004", "2-006", "2-008", "2-013", "2-020", "2-021", "2-024"]],
    ] as const) {
      const forms = DIGIMON_CATALOG.nodes.filter((node) => node.stage === stage)
      const average =
        forms.reduce((sum, node) => sum + node.combatStats.strength + node.combatStats.evasion, 0) / forms.length
      for (const id of familiar) expect(stats(id).strength + stats(id).evasion).toBeGreaterThan(average)
    }
    expect(stats("1-017").evasion).toBeGreaterThan(stats("1-002").evasion) // Poyomon avoids more hits than Botamon.
    expect(stats("1-017").strength).toBeLessThan(stats("1-002").strength)
    expect(stats("2-021").strength).toBeGreaterThan(stats("2-016").strength) // Tokomon attacks; Nyaromon evades.
    expect(stats("2-016").evasion).toBeGreaterThan(stats("2-021").evasion)
    expect(stats("2-022").strength).toBeGreaterThanOrEqual(stats("2-021").strength)
    expect(stats("2-022").evasion).toBeGreaterThan(stats("2-021").evasion)
  })
  test("stronger stats improve actual battle outcomes over reproducible random streams", () => {
    const wins = (strength: number) => {
      let seed = 7231
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 4294967296
      }
      let count = 0
      for (let battle = 0; battle < 2000; battle++)
        if (planCombat({ strength, evasion: 50 }, neutral, random).outcome === "player") count++
      return count
    }
    expect(wins(80)).toBeGreaterThan(wins(50))
    expect(wins(50)).toBeGreaterThan(wins(20))
  })
})
