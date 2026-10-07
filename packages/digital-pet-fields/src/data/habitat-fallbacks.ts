import type { FieldId } from "../domain/world.ts"

// Game habitat choices for entries without Fields in the reference snapshot.
// Babies have a nursery; other choices use the species theme and type.
export const HABITAT_FALLBACKS = {
  "0-001": ["virus-busters"], // Digiegg
  "1-005": ["virus-busters", "nature-spirits"], // Conomon
  "1-006": ["virus-busters", "metal-empire"], // Cotsucomon
  "1-007": ["virus-busters", "nature-spirits"], // Dodomon
  "1-008": ["virus-busters", "dragons-roar"], // Fufumon
  "1-009": ["virus-busters", "nightmare-soldiers"], // Keemon
  "1-011": ["virus-busters", "unknown"], // Kuramon
  "1-015": ["virus-busters", "dragons-roar"], // Petitmon
  "1-018": ["virus-busters", "nature-spirits"], // Punimon
  "1-020": ["virus-busters"], // Puttimon
  "1-021": ["virus-busters", "metal-empire"], // Sakumon
  "1-024": ["virus-busters", "wind-guardians", "jungle-troopers"], // Yuramon
  "1-025": ["virus-busters", "nature-spirits"], // Zerimon
  "1-026": ["virus-busters", "nightmare-soldiers"], // Zurumon
  "1-027": ["virus-busters", "metal-empire"], // Chibickmon
  "1-028": ["virus-busters"], // Dokimon
  "1-030": ["virus-busters", "nature-spirits"], // Relemon
  "1-031": ["virus-busters", "nature-spirits"], // Sandmon
  "2-002": ["virus-busters", "dragons-roar"], // Bebydomon
  "2-003": ["virus-busters", "wind-guardians", "jungle-troopers"], // Budmon
  "2-006": ["virus-busters", "dragons-roar"], // DemiVeemon
  "2-007": ["virus-busters", "nature-spirits"], // Dorimon
  "2-008": ["virus-busters", "nature-spirits"], // Gummymon
  "2-010": ["virus-busters", "metal-empire"], // Kakkinmon
  "2-012": ["virus-busters", "nature-spirits"], // Kokomon
  "2-014": ["virus-busters", "dragons-roar"], // Kyokyomon
  "2-017": ["virus-busters", "nightmare-soldiers"], // Pagumon
  "2-019": ["virus-busters", "metal-empire"], // Sakuttomon
  "2-020": ["virus-busters", "wind-guardians", "jungle-troopers"], // Tanemon
  "2-022": ["virus-busters"], // Tokomon X
  "2-023": ["virus-busters", "unknown"], // Tsumemon
  "2-024": ["virus-busters", "nature-spirits"], // Tsunomon
  "2-027": ["virus-busters", "nightmare-soldiers"], // Yaamon
  "2-029": ["virus-busters", "nature-spirits"], // Bibimon
  "2-031": ["virus-busters", "nature-spirits"], // Tumblemon
  "2-032": ["virus-busters", "deep-savers"], // Hiyarimon
  "2-033": ["virus-busters", "jungle-troopers"], // Minomon
  "2-034": ["virus-busters", "nightmare-soldiers"], // Moonmon
  "2-035": ["virus-busters", "metal-empire"], // Pickmon
  "2-036": ["virus-busters", "nature-spirits"], // Viximon
  "2-037": ["virus-busters", "wind-guardians"], // Sunmon
  "3-002": ["dragons-roar"], // Agumon (Black) X
  "3-003": ["dragons-roar"], // Agumon Expert
  "3-009": ["dragons-roar", "deep-savers"], // Bulucomon
  "3-017": ["dragons-roar"], // Dracomon X
  "3-035": ["nature-spirits"], // Herissmon
  "3-038": ["nightmare-soldiers", "dark-area"], // Impmon X
  "3-041": ["unknown"], // Keramon X
  "3-048": ["nature-spirits"], // Lopmon X
  "3-049": ["metal-empire"], // Ludomon
  "3-061": ["nature-spirits"], // Renamon X
  "3-075": ["nature-spirits"], // Terriermon X
  "3-079": ["dragons-roar"], // Vorvomon
  "3-084": ["nature-spirits", "virus-busters"], // Pulsemon
  "4-021": ["metal-empire", "unknown"], // Damemon
  "4-024": ["dragons-roar"], // DarkTyrannomon X
  "4-039": ["nature-spirits"], // Filmon
  "4-061": ["dragons-roar", "metal-empire"], // Jazardmon
  "4-068": ["dragons-roar"], // Lavorvomon
  "4-080": ["nightmare-soldiers"], // Meramon X
  "4-089": ["unknown"], // Numemon X
  "4-092": ["nightmare-soldiers"], // Ogremon X
  "4-094": ["dragons-roar", "deep-savers"], // Paledramon
  "4-097": ["nature-spirits", "virus-busters", "wind-guardians"], // Pegasusmon X
  "4-109": ["virus-busters"], // Seasarmon X
  "4-114": ["virus-busters"], // Sistermon Ciel
  "4-122": ["unknown"], // Targetmon
  "4-124": ["metal-empire"], // TiaLudomon
  "4-136": ["dragons-roar"], // Tyrannomon X
  "4-144": ["nightmare-soldiers"], // Wizardmon X
  "4-147": ["dragons-roar"], // Bulkmon
  "5-005": ["virus-busters"], // Angewomon X
  "5-024": ["dragons-roar", "deep-savers"], // CrysPaledramon
  "5-026": ["dragons-roar", "metal-empire"], // Cyberdramon X
  "5-054": ["dragons-roar", "metal-empire"], // Jazarichmon
  "5-060": ["nightmare-soldiers", "dark-area"], // LadyDevimon X
  "5-061": ["dragons-roar"], // Lavogaritamon
  "5-084": ["nightmare-soldiers", "dark-area"], // Mephistomon X
  "5-089": ["dragons-roar", "metal-empire"], // MetalGreymon (Virus) X
  "5-096": ["virus-busters", "unknown"], // Monzaemon X
  "5-099": ["nightmare-soldiers", "dark-area"], // Myotismon X
  "5-103": ["dragons-roar", "virus-busters"], // OmniShoutmon X
  "5-114": ["nightmare-soldiers"], // Rhihimon
  "5-116": ["dragons-roar", "metal-empire"], // RizeGreymon X
  "5-128": ["nature-spirits"], // Stefilmon
  "5-144": ["nature-spirits"], // Boutmon
  "6-019": ["nightmare-soldiers", "dark-area"], // Bagramon
  "6-024": ["nightmare-soldiers", "dark-area"], // BeelStarmon X
  "6-031": ["metal-empire"], // BryweLudramon
  "6-034": ["virus-busters"], // Cherubimon (Virtue) X
  "6-035": ["nightmare-soldiers", "dark-area"], // Cherubimon (Vice) X
  "6-040": ["nightmare-soldiers", "dark-area"], // DarkKnightmon X
  "6-067": ["deep-savers"], // Hexeblaumon
  "6-070": ["metal-empire", "virus-busters"], // Justimon X
  "6-093": ["dragons-roar", "metal-empire"], // Metallicdramon
  "6-101": ["virus-busters"], // Ophanimon X
  "6-102": ["nightmare-soldiers", "dark-area"], // Ophanimon: Falldown Mode X
  "6-106": ["virus-busters", "wind-guardians"], // Phoenixmon X
  "6-115": ["nightmare-soldiers", "dark-area"], // Raguelmon
  "6-116": ["virus-busters"], // Rapidmon X
  "6-117": ["nature-spirits"], // Rasenmon
  "6-118": ["nature-spirits"], // Rasenmon: Fury Mode
  "6-122": ["nightmare-soldiers"], // Rhihimon
  "6-127": ["virus-busters", "wind-guardians"], // Sakuyamon X
  "6-142": ["dragons-roar"], // Volcanicdramon
  "6-147": ["nature-spirits", "unknown"], // ShinMonzaemon
  "6-148": ["virus-busters", "wind-guardians"], // Kazuchimon
  "7-006": ["nightmare-soldiers", "dark-area"], // Belphemon X
  "7-012": ["unknown"], // Diaboromon X
  "7-015": ["dragons-roar", "virus-busters"], // Examon X
  "7-018": ["virus-busters", "unknown"], // GraceNovamon
  "7-021": ["virus-busters"], // Jesmon X
  "7-024": ["nightmare-soldiers", "dark-area", "deep-savers"], // Leviamon X
  "7-026": ["virus-busters"], // LordKnightmon X
  "7-027": ["nightmare-soldiers", "dark-area"], // Lucemon X
  "7-030": ["virus-busters"], // Minervamon X
  "7-035": ["nightmare-soldiers", "dark-area", "unknown"], // Ordinemon
  "7-037": ["metal-empire", "virus-busters"], // RagnaLoardmon
  "7-038": ["nature-spirits"], // Rasenmon
  "7-043": ["virus-busters"], // Jesmon GX
  "7-044": ["nightmare-soldiers", "dark-area"], // Ogudomon X
} as const satisfies Record<string, readonly FieldId[]>
