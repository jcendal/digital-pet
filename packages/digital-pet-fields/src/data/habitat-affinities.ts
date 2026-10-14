import type { FieldId } from "../domain/world.ts"

/** Authored game affinities, not replacements for source Fields.
 * Type evidence: https://digimon-db.omnipet.app.br/api/digimon?type=<id>&limit=216
 * Reviewed 2026-10-14: Insectoid 66, Vegetation 54, Demon 27, Dark Angel 76, Evil King 11.
 * Match exact forms; source omissions and base/X variants never imply interchangeable species.
 */
export const HABITAT_AFFINITIES = [
  { nodeId: "3-052", fieldId: "jungle-troopers", sourceId: "morphomon", sourceTypeId: 66 },
  { nodeId: "4-059", fieldId: "jungle-troopers", sourceId: "hudiemon", sourceTypeId: 66 },
  { nodeId: "4-105", fieldId: "jungle-troopers", sourceId: "gokimon", sourceTypeId: 66 },
  { nodeId: "4-110", fieldId: "jungle-troopers", sourceId: "shadramon", sourceTypeId: 66 },
  { nodeId: "5-055", fieldId: "jungle-troopers", sourceId: "jewelbeemon", sourceTypeId: 66 },
  { nodeId: "5-101", fieldId: "jungle-troopers", sourceId: "okuwamon", sourceTypeId: 66 },
  { nodeId: "5-148", fieldId: "jungle-troopers", sourceId: "scorpiomon", sourceTypeId: 66 },
  { nodeId: "3-057", fieldId: "jungle-troopers", sourceId: "palmon_x", sourceTypeId: 54 },
  { nodeId: "3-060", fieldId: "jungle-troopers", sourceId: "pomumon", sourceTypeId: 54 },
  { nodeId: "4-102", fieldId: "jungle-troopers", sourceId: "redvegimon", sourceTypeId: 54 },
  { nodeId: "4-128", fieldId: "jungle-troopers", sourceId: "togemon_x", sourceTypeId: 54 },
  { nodeId: "5-014", fieldId: "jungle-troopers", sourceId: "blossomon", sourceTypeId: 54 },
  { nodeId: "5-037", fieldId: "jungle-troopers", sourceId: "entmon", sourceTypeId: 54 },
  { nodeId: "5-052", fieldId: "jungle-troopers", sourceId: "jyagamon", sourceTypeId: 54 },
  { nodeId: "5-130", fieldId: "jungle-troopers", sourceId: "toropiamon", sourceTypeId: 54 },
  { nodeId: "4-092", fieldId: "dark-area", sourceId: "orgemon_x", sourceTypeId: 27 },
  { nodeId: "4-148", fieldId: "dark-area", sourceId: "fugamon", sourceTypeId: 27 },
  { nodeId: "5-033", fieldId: "dark-area", sourceId: "donedevimon", sourceTypeId: 76 },
  { nodeId: "5-059", fieldId: "dark-area", sourceId: "ladydevimon", sourceTypeId: 76 },
  { nodeId: "5-100", fieldId: "dark-area", sourceId: "neodevimon", sourceTypeId: 76 },
  { nodeId: "6-097", fieldId: "dark-area", sourceId: "murmukusmon", sourceTypeId: 11 },
  { nodeId: "7-004", fieldId: "dark-area", sourceId: "beelzebumon_x", sourceTypeId: 11 },
] as const satisfies readonly {
  readonly nodeId: string
  readonly fieldId: FieldId
  readonly sourceId: string
  readonly sourceTypeId: number
}[]
