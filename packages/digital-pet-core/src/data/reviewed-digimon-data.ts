import corrections from "./catalog-corrections.json" with { type: "json" }
import { DIGIMON_DATA, type DigimonRecord } from "./digimon-data.ts"

/** Keep generated records and saved IDs intact; apply reviewed identity corrections before matching routes. */
export const REVIEWED_DIGIMON_DATA: readonly DigimonRecord[] = Object.freeze(
  DIGIMON_DATA.map((node) =>
    Object.freeze({ ...node, ...(corrections.records as Readonly<Record<string, Partial<DigimonRecord>>>)[node.id] }),
  ),
)
