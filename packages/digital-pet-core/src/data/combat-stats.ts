import { type CombatStats, validateCombatStats } from "../domain/combat.ts"

/** Initial game balance, not official Digimon statistics. Explicit IDs make changes reviewable. */
export const COMBAT_STATS: ReadonlyMap<string, CombatStats> = new Map(
  (
    [
      ["0-001", 0, 0], // Digiegg
      // Baby I: gentle variation around (25, 35); familiar starters receive a modest edge.
      ["1-001", 26, 34], // Argomon: balanced
      ["1-002", 29, 37], // Botamon: versatile classic
      ["1-003", 27, 38], // Chibomon: agile starter
      ["1-004", 25, 32], // Choromon: measured attacker
      ["1-005", 24, 38], // Conomon: evasive
      ["1-006", 28, 31], // Cotsucomon: offense over mobility
      ["1-007", 29, 33], // Dodomon: assertive attacker
      ["1-008", 23, 40], // Fufumon: elusive
      ["1-009", 26, 36], // Keemon: balanced
      ["1-010", 27, 34], // Ketomon: offensive leaning
      ["1-011", 28, 36], // Kuramon: accurate, still mobile
      ["1-012", 22, 39], // Mokumon: evasive specialist
      ["1-013", 23, 36], // Nyokimon: defensive leaning
      ["1-014", 24, 37], // Pabumon: defensive leaning
      ["1-015", 30, 31], // Petitmon: strongest attack, low evasion
      ["1-016", 22, 38], // Pichimon: evasive specialist
      ["1-017", 24, 41], // Poyomon: elusive classic
      ["1-018", 30, 35], // Punimon: offensive classic
      ["1-019", 23, 39], // Pururumon: elusive
      ["1-020", 25, 39], // Puttimon: defensive balance
      ["1-021", 28, 32], // Sakumon: offensive specialist
      ["1-022", 26, 37], // Tsubumon: steady all-rounder
      ["1-023", 24, 40], // YukimiBotamon: evasive starter
      ["1-024", 25, 40], // Yuramon: defensive classic
      ["1-025", 27, 35], // Zerimon: offensive balance
      ["1-026", 25, 34], // Zurumon: balanced
      ["1-027", 26, 38], // Chibickmon: mobile all-rounder
      ["1-028", 26, 33], // Dokimon: offensive leaning
      ["1-029", 30, 33], // Jyarimon: offensive starter
      ["1-030", 23, 41], // Relemon: elusive specialist
      ["1-031", 28, 34], // Sandmon: offensive balance
      // Baby II: variation around (35, 40); distinct roles with no overwhelming starter.
      ["2-001", 37, 38], // Argomon: offensive balance
      ["2-002", 39, 36], // Bebydomon: offensive specialist
      ["2-003", 34, 41], // Budmon: defensive balance
      ["2-004", 35, 46], // Bukamon: evasive classic
      ["2-005", 40, 35], // DemiMeramon: offense over mobility
      ["2-006", 40, 42], // DemiVeemon: versatile starter
      ["2-007", 41, 37], // Dorimon: assertive attacker
      ["2-008", 37, 45], // Gummymon: agile starter
      ["2-009", 38, 39], // Hopmon: offensive balance
      ["2-010", 39, 35], // Kakkinmon: offense over mobility
      ["2-011", 36, 38], // Kapurimon: measured attacker
      ["2-012", 36, 45], // Kokomon: agile starter
      ["2-013", 40, 43], // Koromon: versatile classic
      ["2-014", 33, 44], // Kyokyomon: evasive specialist
      ["2-015", 37, 43], // Motimon: balanced classic
      ["2-016", 33, 47], // Nyaromon: agile, weaker attack
      ["2-017", 35, 42], // Pagumon: defensive balance
      ["2-018", 32, 46], // Poromon: elusive specialist
      ["2-019", 40, 36], // Sakuttomon: offensive specialist
      ["2-020", 34, 46], // Tanemon: defensive classic
      ["2-021", 42, 40], // Tokomon: powerful bite, moderate evasion
      ["2-022", 42, 42], // Tokomon X: a small evasion upgrade
      ["2-023", 41, 36], // Tsumemon: offensive specialist
      ["2-024", 41, 42], // Tsunomon: offensive classic
      ["2-025", 34, 44], // Upamon: defensive balance
      ["2-026", 35, 45], // Wanyamon: agile all-rounder
      ["2-027", 38, 38], // Yaamon: offensive balance
      ["2-028", 35, 44], // Yokomon: defensive classic
      ["2-029", 36, 44], // Bibimon: mobile all-rounder
      ["2-030", 42, 38], // Gigimon: offensive starter
      ["2-031", 38, 36], // Tumblemon: offensive leaning
      ["2-032", 33, 43], // Hiyarimon: evasive specialist
      ["2-033", 32, 40], // Minomon: modest defensive profile
      ["2-034", 31, 45], // Moonmon: evasion over offense
      ["2-035", 36, 39], // Pickmon: balanced
      ["2-036", 34, 47], // Viximon: elusive starter
      ["2-037", 39, 37], // Sunmon: offense over evasion
      ["3-001", 58, 44], // Agumon
      ["3-002", 50, 50], // Agumon (Black) X
      ["3-003", 50, 50], // Agumon Expert
      ["3-004", 50, 50], // Agumon X
      ["3-005", 50, 50], // Argomon
      ["3-006", 50, 50], // Armadillomon
      ["3-007", 50, 50], // Betamon
      ["3-008", 50, 50], // Biyomon
      ["3-009", 50, 50], // Bulucomon
      ["3-010", 50, 50], // BushiAgumon
      ["3-011", 50, 50], // Candlemon
      ["3-012", 50, 50], // Coronamon
      ["3-013", 50, 50], // Crabmon
      ["3-014", 50, 50], // DemiDevimon
      ["3-015", 50, 50], // Dorumon
      ["3-016", 50, 50], // Dracomon
      ["3-017", 50, 50], // Dracomon X
      ["3-018", 50, 50], // Duskmon
      ["3-019", 50, 50], // Elecmon
      ["3-020", 50, 50], // Falcomon
      ["3-021", 46, 54], // Floramon
      ["3-022", 50, 56], // Gabumon
      ["3-023", 50, 50], // Gabumon X
      ["3-024", 50, 50], // Gaomon
      ["3-025", 52, 68], // Gatomon
      ["3-026", 50, 50], // Gazimon
      ["3-027", 50, 50], // Ghostmon
      ["3-028", 50, 50], // Gizamon
      ["3-029", 50, 50], // Gomamon
      ["3-030", 50, 50], // Gomamon X
      ["3-031", 50, 50], // Gotsumon
      ["3-032", 50, 50], // Guilmon
      ["3-033", 50, 50], // Hagurumon
      ["3-034", 42, 62], // Hawkmon
      ["3-035", 50, 50], // Herissmon
      ["3-036", 50, 50], // Huckmon
      ["3-037", 50, 50], // Impmon
      ["3-038", 50, 50], // Impmon X
      ["3-039", 50, 50], // Jazamon
      ["3-040", 50, 50], // Junkmon
      ["3-041", 50, 50], // Keramon X
      ["3-042", 50, 50], // Kokuwamon
      ["3-043", 50, 50], // Kokuwamon X
      ["3-044", 50, 50], // Kunemon
      ["3-045", 50, 50], // Labramon
      ["3-046", 50, 50], // Lalamon
      ["3-047", 50, 50], // Lopmon
      ["3-048", 50, 50], // Lopmon X
      ["3-049", 50, 50], // Ludomon
      ["3-050", 50, 50], // Lunamon
      ["3-051", 50, 50], // Monodramon
      ["3-052", 50, 50], // Morphomon
      ["3-053", 50, 50], // Mushroomon
      ["3-054", 50, 50], // Otamamon
      ["3-055", 50, 50], // Otamamon X
      ["3-056", 46, 54], // Palmon
      ["3-057", 46, 54], // Palmon X
      ["3-058", 44, 66], // Patamon
      ["3-059", 50, 50], // Phascomon
      ["3-060", 50, 50], // Pomumon
      ["3-061", 50, 50], // Renamon X
      ["3-062", 50, 50], // Ryudamon
      ["3-063", 50, 50], // Salamon
      ["3-064", 50, 50], // Salamon X
      ["3-065", 50, 50], // Sangomon
      ["3-066", 50, 50], // Shoutmon
      ["3-067", 50, 50], // Sistermon Blanc
      ["3-068", 50, 50], // Sunarizamon
      ["3-069", 50, 50], // Swimmon
      ["3-070", 50, 50], // Syakomon
      ["3-071", 50, 50], // Syakomon X
      ["3-072", 50, 50], // Tapirmon
      ["3-073", 50, 50], // Tentomon
      ["3-074", 50, 50], // Terriermon
      ["3-075", 50, 50], // Terriermon X
      ["3-076", 50, 50], // Tinkermon
      ["3-077", 50, 50], // ToyAgumon
      ["3-078", 50, 50], // Veemon
      ["3-079", 50, 50], // Vorvomon
      ["3-080", 50, 50], // Wormmon
      ["3-081", 50, 50], // Zubamon
      ["3-082", 50, 50], // Agumon (Black)
      ["3-083", 50, 50], // Dracmon
      ["3-084", 50, 50], // Pulsemon
      ["3-085", 50, 50], // Renamon
      ["4-001", 60, 50], // Agunimon
      ["4-002", 60, 50], // Airdramon
      ["4-003", 60, 50], // Allomon X
      ["4-004", 68, 60], // Angemon
      ["4-005", 60, 50], // Ankylomon
      ["4-006", 60, 50], // Apemon
      ["4-007", 60, 50], // Aquilamon
      ["4-008", 60, 50], // Argomon
      ["4-009", 60, 50], // Arresterdramon
      ["4-010", 60, 50], // Baboongamon
      ["4-011", 60, 50], // Bakemon
      ["4-012", 60, 50], // Baluchimon
      ["4-013", 60, 50], // BaoHuckmon
      ["4-014", 52, 62], // Birdramon
      ["4-015", 60, 50], // Centarumon
      ["4-016", 60, 50], // Clockmon
      ["4-017", 60, 50], // Coelamon
      ["4-018", 60, 50], // Coredramon (Blue)
      ["4-019", 60, 50], // Coredramon (Green)
      ["4-020", 60, 50], // Cyclonemon
      ["4-021", 60, 50], // Damemon
      ["4-022", 60, 50], // Darcmon
      ["4-023", 72, 38], // DarkTyrannomon
      ["4-024", 72, 38], // DarkTyrannomon X
      ["4-025", 60, 50], // Deltamon
      ["4-026", 60, 50], // Deputymon
      ["4-027", 60, 50], // Devidramon
      ["4-028", 60, 50], // Devimon
      ["4-029", 60, 50], // Diatrymon
      ["4-030", 60, 50], // Dobermon
      ["4-031", 60, 50], // Dokugumon
      ["4-032", 60, 50], // Dolphmon
      ["4-033", 60, 50], // Dorugamon
      ["4-034", 60, 50], // Drimogemon
      ["4-035", 60, 50], // Duskmon
      ["4-036", 60, 50], // Ebidramon
      ["4-037", 60, 50], // Eosmon
      ["4-038", 60, 50], // ExVeemon
      ["4-039", 60, 50], // Filmon
      ["4-040", 60, 50], // Firamon
      ["4-041", 60, 50], // Flarerizamon
      ["4-042", 52, 62], // Flymon
      ["4-043", 60, 50], // Frigimon
      ["4-044", 60, 50], // Gaogamon
      ["4-045", 60, 50], // Gargomon
      ["4-046", 64, 70], // Garurumon
      ["4-047", 52, 68], // Gatomon
      ["4-048", 60, 50], // Gatomon X
      ["4-049", 60, 50], // Gekomon
      ["4-050", 72, 38], // GeoGreymon
      ["4-051", 60, 50], // Gesomon
      ["4-052", 60, 50], // Ginryumon
      ["4-053", 72, 38], // Golemon
      ["4-054", 78, 35], // Greymon
      ["4-055", 60, 50], // Growlmon
      ["4-056", 60, 50], // Growlmon X
      ["4-057", 68, 42], // Guardromon
      ["4-058", 60, 50], // Hookmon
      ["4-059", 60, 50], // Hudiemon
      ["4-060", 60, 50], // Ikkakumon
      ["4-061", 60, 50], // Jazardmon
      ["4-062", 60, 50], // Kabuterimon
      ["4-063", 60, 50], // Kiwimon
      ["4-064", 60, 50], // Kokatorimon
      ["4-065", 60, 50], // Komondomon
      ["4-066", 60, 50], // Kuwagamon
      ["4-067", 60, 50], // Kuwagamon X
      ["4-068", 60, 50], // Lavorvomon
      ["4-069", 60, 50], // Lekismon
      ["4-070", 60, 50], // Leomon
      ["4-071", 60, 50], // Leomon X
      ["4-072", 60, 50], // Lobomon
      ["4-073", 60, 50], // Machmon
      ["4-074", 60, 50], // MadLeomon
      ["4-075", 60, 50], // Manbomon
      ["4-076", 60, 50], // Mantaraymon X
      ["4-077", 60, 50], // Meicoomon
      ["4-078", 60, 50], // Mekanorimon
      ["4-079", 60, 50], // Meramon
      ["4-080", 60, 50], // Meramon X
      ["4-081", 60, 50], // Mimicmon
      ["4-082", 60, 50], // Minotarumon
      ["4-083", 60, 50], // Mojyamon
      ["4-084", 60, 50], // Monochromon
      ["4-085", 60, 50], // Nanimon
      ["4-086", 60, 50], // Nefertimon X
      ["4-087", 52, 62], // Ninjamon
      ["4-088", 35, 40], // Numemon
      ["4-089", 60, 50], // Numemon X
      ["4-090", 60, 50], // Octomon
      ["4-091", 72, 38], // Ogremon
      ["4-092", 72, 38], // Ogremon X
      ["4-093", 60, 50], // Omekamon
      ["4-094", 60, 50], // Paledramon
      ["4-095", 60, 50], // Parasaurmon
      ["4-096", 60, 50], // Peckmon
      ["4-097", 60, 50], // Pegasusmon X
      ["4-098", 60, 50], // Petermon
      ["4-099", 60, 50], // Porcupamon
      ["4-100", 60, 50], // Pteramon X
      ["4-101", 60, 50], // Raremon
      ["4-102", 56, 54], // RedVegiemon
      ["4-103", 60, 50], // Reppamon
      ["4-104", 60, 50], // Rhinomon X
      ["4-105", 60, 50], // Roachmon
      ["4-106", 60, 50], // Sangloupmon
      ["4-107", 60, 50], // Seadramon
      ["4-108", 60, 50], // Seadramon X
      ["4-109", 60, 50], // Seasarmon X
      ["4-110", 60, 50], // Shadramon
      ["4-111", 60, 50], // Shellmon
      ["4-112", 60, 50], // ShellNumemon
      ["4-113", 60, 50], // Shoutmon X3
      ["4-114", 60, 50], // Sistermon Ciel
      ["4-115", 60, 50], // Starmon
      ["4-116", 52, 62], // Stingmon
      ["4-117", 60, 50], // Strikedramon
      ["4-118", 60, 50], // Submarimon
      ["4-119", 60, 50], // Sukamon
      ["4-120", 60, 50], // Sunflowmon
      ["4-121", 68, 42], // Tankmon
      ["4-122", 60, 50], // Targetmon
      ["4-123", 60, 50], // Thundermon
      ["4-124", 60, 50], // TiaLudomon
      ["4-125", 60, 50], // Tobiumon
      ["4-126", 60, 50], // TobuCatmon
      ["4-127", 56, 54], // Togemon
      ["4-128", 56, 54], // Togemon X
      ["4-129", 60, 50], // Tortomon
      ["4-130", 60, 50], // Troopmon
      ["4-131", 60, 50], // Turuiemon
      ["4-132", 60, 50], // Tuskmon
      ["4-133", 60, 50], // Tylomon
      ["4-134", 60, 50], // Tylomon X
      ["4-135", 72, 38], // Tyrannomon
      ["4-136", 72, 38], // Tyrannomon X
      ["4-137", 60, 50], // Unimon
      ["4-138", 60, 50], // Veedramon
      ["4-139", 56, 54], // Vegiemon
      ["4-140", 60, 50], // Velgrmon
      ["4-141", 60, 50], // Whamon
      ["4-142", 63, 57], // Witchmon
      ["4-143", 63, 57], // Wizardmon
      ["4-144", 63, 57], // Wizardmon X
      ["4-145", 56, 54], // Woodmon
      ["4-146", 60, 50], // ZubaEagermon
      ["4-147", 60, 50], // Bulkmon
      ["4-148", 60, 50], // Fugamon
      ["4-149", 60, 50], // Hyogamon
      ["4-150", 60, 50], // Piddomon
      ["4-151", 60, 50], // Rhinomon
      ["4-152", 60, 50], // Saberdramon
      ["5-001", 70, 55], // AeroVeedramon
      ["5-002", 70, 55], // Aldamon
      ["5-003", 78, 47], // Andromon
      ["5-004", 70, 55], // Angewomon
      ["5-005", 70, 55], // Angewomon X
      ["5-006", 70, 55], // Antylamon
      ["5-007", 70, 55], // Argomon
      ["5-008", 70, 55], // Arukenimon
      ["5-009", 70, 55], // Astamon
      ["5-010", 70, 55], // Asuramon
      ["5-011", 70, 55], // Baalmon
      ["5-012", 70, 55], // Beowolfmon
      ["5-013", 70, 55], // BigMamemon
      ["5-014", 66, 59], // Blossomon
      ["5-015", 70, 55], // Bulbmon
      ["5-016", 82, 43], // BurningGreymon
      ["5-017", 70, 55], // CannonBeemon
      ["5-018", 70, 55], // Cerberusmon
      ["5-019", 70, 55], // Cerberusmon X
      ["5-020", 70, 55], // Cherrymon
      ["5-021", 70, 55], // Cho-Hakkaimon
      ["5-022", 70, 55], // Crescemon
      ["5-023", 70, 55], // Crowmon
      ["5-024", 70, 55], // CrysPaledramon
      ["5-025", 78, 47], // Cyberdramon
      ["5-026", 78, 47], // Cyberdramon X
      ["5-027", 70, 55], // DarkKnightmon
      ["5-028", 70, 55], // Datamon
      ["5-029", 70, 55], // Deramon
      ["5-030", 70, 55], // Digitamamon
      ["5-031", 82, 43], // Dinobeemon
      ["5-032", 70, 55], // Divermon
      ["5-033", 70, 55], // DoneDevimon
      ["5-034", 82, 43], // DoruGreymon
      ["5-035", 70, 55], // Dragomon
      ["5-036", 70, 55], // Duramon
      ["5-037", 70, 55], // Entmon
      ["5-038", 70, 55], // Eosmon
      ["5-039", 70, 55], // Etemon
      ["5-040", 82, 43], // ExTyrannomon
      ["5-041", 70, 55], // Flaremon
      ["5-042", 70, 55], // Garbagemon
      ["5-043", 70, 55], // Garudamon
      ["5-044", 70, 55], // Garudamon X
      ["5-045", 70, 55], // Giromon
      ["5-046", 70, 55], // Gogmamon
      ["5-047", 70, 55], // Grademon
      ["5-048", 70, 55], // Groundramon
      ["5-049", 70, 55], // Gusokumon
      ["5-050", 70, 55], // HippoGryphonmon
      ["5-051", 70, 55], // Hisyaryumon
      ["5-052", 70, 55], // Jagamon
      ["5-053", 70, 55], // JagerLoweemon
      ["5-054", 70, 55], // Jazarichmon
      ["5-055", 70, 55], // JewelBeemon
      ["5-056", 70, 55], // KendoGarurumon
      ["5-057", 70, 55], // Kimeramon
      ["5-058", 70, 55], // Knightmon
      ["5-059", 70, 55], // LadyDevimon
      ["5-060", 70, 55], // LadyDevimon X
      ["5-061", 70, 55], // Lavogaritamon
      ["5-062", 70, 55], // Lilamon
      ["5-063", 70, 55], // Lillymon
      ["5-064", 70, 55], // Lillymon X
      ["5-065", 70, 55], // LoaderLeomon
      ["5-066", 70, 55], // Locomon
      ["5-067", 70, 55], // Lucemon: Chaos Mode
      ["5-068", 70, 55], // MachGaogamon
      ["5-069", 73, 62], // MagnaAngemon
      ["5-070", 70, 55], // Mamemon
      ["5-071", 70, 55], // Mamemon X
      ["5-072", 70, 55], // Mametyramon
      ["5-073", 82, 43], // Mammothmon
      ["5-074", 82, 43], // Mammothmon X
      ["5-075", 70, 55], // Manticoremon
      ["5-076", 70, 55], // MarineChimairamon
      ["5-077", 70, 55], // MarineDevimon
      ["5-078", 70, 55], // Maycrackmon
      ["5-079", 70, 55], // Maycrackmon: Vicious Mode
      ["5-080", 70, 55], // Megadramon
      ["5-081", 70, 55], // MegaKabuterimon (Red)
      ["5-082", 70, 55], // MegaSeadramon
      ["5-083", 70, 55], // MegaSeadramon X
      ["5-084", 70, 55], // Mephistomon X
      ["5-085", 70, 55], // Mermaimon
      ["5-086", 78, 47], // MetalGreymon
      ["5-087", 78, 47], // MetalGreymon (Vaccine)
      ["5-088", 78, 47], // MetalGreymon (Virus)
      ["5-089", 78, 47], // MetalGreymon (Virus) X
      ["5-090", 78, 47], // MetalGreymon X
      ["5-091", 78, 47], // MetalMamemon
      ["5-092", 78, 47], // MetalPhantomon
      ["5-093", 78, 47], // MetalTyrannomon
      ["5-094", 78, 47], // MetalTyrannomon X
      ["5-095", 70, 55], // Monzaemon
      ["5-096", 70, 55], // Monzaemon X
      ["5-097", 70, 55], // Mummymon
      ["5-098", 70, 55], // Myotismon
      ["5-099", 70, 55], // Myotismon X
      ["5-100", 70, 55], // NeoDevimon
      ["5-101", 70, 55], // Okuwamon
      ["5-102", 70, 55], // Okuwamon X
      ["5-103", 70, 55], // OmniShoutmon X
      ["5-104", 70, 55], // Orochimon
      ["5-105", 70, 55], // Paildramon
      ["5-106", 70, 55], // Parrotmon
      ["5-107", 70, 55], // Phantomon
      ["5-108", 70, 55], // Piranimon
      ["5-109", 70, 55], // Piximon
      ["5-110", 70, 55], // Pumpkinmon
      ["5-111", 70, 55], // RaijiLudomon
      ["5-112", 70, 55], // Rapidmon
      ["5-113", 70, 55], // Rebellimon
      ["5-114", 70, 55], // Rhihimon
      ["5-115", 82, 43], // RizeGreymon
      ["5-116", 82, 43], // RizeGreymon X
      ["5-117", 70, 55], // SaviorHuckmon
      ["5-118", 70, 55], // Scorpiomon
      ["5-119", 70, 55], // Scorpiomon X
      ["5-120", 70, 55], // Shakkoumon
      ["5-121", 70, 55], // ShogunGekomon
      ["5-122", 70, 55], // Shoutmon X5
      ["5-123", 70, 55], // Silphymon
      ["5-124", 70, 55], // Sirenmon
      ["5-125", 70, 55], // SkullBaluchimon
      ["5-126", 82, 43], // SkullGreymon
      ["5-127", 70, 55], // SkullMeramon
      ["5-128", 70, 55], // Stefilmon
      ["5-129", 70, 55], // Tekkamon
      ["5-130", 70, 55], // Toropiamon
      ["5-131", 82, 43], // Triceramon
      ["5-132", 82, 43], // Triceramon X
      ["5-133", 70, 55], // Vademon
      ["5-134", 70, 55], // Velgrmon
      ["5-135", 70, 55], // WarGrowlmon
      ["5-136", 70, 55], // WarGrowlmon X
      ["5-137", 70, 55], // WaruMonzaemon
      ["5-138", 70, 55], // WaruSeadramon
      ["5-139", 70, 55], // WereGarurumon
      ["5-140", 70, 55], // WereGarurumon X
      ["5-141", 70, 55], // Whamon
      ["5-142", 70, 55], // Wingdramon
      ["5-143", 70, 55], // Zudomon
      ["5-144", 70, 55], // Boutmon
      ["5-145", 70, 55], // DarkSuperStarmon
      ["5-146", 70, 55], // Doruguremon
      ["5-147", 70, 55], // Pandamon
      ["5-148", 70, 55], // SkullScorpiomon
      ["5-149", 70, 55], // SuperStarmon
      ["6-001", 80, 60], // Aegisdramon
      ["6-002", 80, 60], // Alphamon
      ["6-003", 80, 60], // AncientBeetlemon
      ["6-004", 80, 60], // AncientGarurumon
      ["6-005", 92, 48], // AncientGreymon
      ["6-006", 80, 60], // AncientKazemon
      ["6-007", 80, 60], // AncientMegatheriummon
      ["6-008", 80, 60], // AncientMermaimon
      ["6-009", 80, 60], // AncientSphinxmon
      ["6-010", 80, 60], // AncientTroymon
      ["6-011", 80, 60], // AncientVolcanomon
      ["6-012", 80, 60], // AncientWisemon
      ["6-013", 80, 60], // Anubismon
      ["6-014", 80, 60], // Apocalymon
      ["6-015", 80, 60], // Apollomon
      ["6-016", 80, 60], // Argomon
      ["6-017", 80, 60], // Armageddemon
      ["6-018", 80, 60], // Azulongmon
      ["6-019", 80, 60], // Bagramon
      ["6-020", 80, 60], // Baihumon
      ["6-021", 80, 60], // BanchoLeomon
      ["6-022", 80, 60], // BanchoMamemon
      ["6-023", 80, 60], // Barbamon
      ["6-024", 80, 60], // BeelStarmon X
      ["6-025", 80, 60], // Beelzemon
      ["6-026", 80, 60], // Belphemon: Rage Mode
      ["6-027", 92, 48], // BlackWarGreymon X
      ["6-028", 92, 48], // BlitzGreymon
      ["6-029", 80, 60], // Boltmon
      ["6-030", 80, 60], // Breakdramon
      ["6-031", 80, 60], // BryweLudramon
      ["6-032", 80, 60], // Chaosdramon X
      ["6-033", 80, 60], // Cherubimon (Virtue)
      ["6-034", 80, 60], // Cherubimon (Virtue) X
      ["6-035", 80, 60], // Cherubimon (Vice) X
      ["6-036", 80, 60], // Craniamon
      ["6-037", 80, 60], // Creepymon
      ["6-038", 80, 60], // CresGarurumon
      ["6-039", 80, 60], // Darkdramon
      ["6-040", 80, 60], // DarkKnightmon X
      ["6-041", 80, 60], // Dianamon
      ["6-042", 92, 48], // Dinorexmon
      ["6-043", 92, 48], // Dinotigermon
      ["6-044", 80, 60], // Durandamon
      ["6-045", 80, 60], // Dynasmon
      ["6-046", 80, 60], // Ebemon X
      ["6-047", 80, 60], // Ebonwumon
      ["6-048", 92, 48], // EmperorGreymon
      ["6-049", 80, 60], // Eosmon
      ["6-050", 80, 60], // Fanglongmon
      ["6-051", 80, 60], // Gaiomon
      ["6-052", 80, 60], // Gallantmon
      ["6-053", 80, 60], // Gallantmon X
      ["6-054", 80, 60], // Gankoomon
      ["6-055", 80, 60], // Ghoulmon
      ["6-056", 92, 48], // GigaSeadramon
      ["6-057", 80, 60], // Goldramon
      ["6-058", 80, 60], // Goldramon X
      ["6-059", 80, 60], // GrandisKuwagamon
      ["6-060", 80, 60], // GranDracmon
      ["6-061", 80, 60], // GranKuwagamon
      ["6-062", 80, 60], // GroundLocomon
      ["6-063", 80, 60], // Gryphonmon
      ["6-064", 80, 60], // Gundramon
      ["6-065", 80, 60], // HeavyLeomon
      ["6-066", 80, 60], // HerculesKabuterimon
      ["6-067", 80, 60], // Hexeblaumon
      ["6-068", 88, 52], // HiAndromon
      ["6-069", 80, 60], // Jesmon
      ["6-070", 80, 60], // Justimon X
      ["6-071", 80, 60], // Justimon: Blitz Arm
      ["6-072", 80, 60], // Kentaurosmon
      ["6-073", 80, 60], // KingEtemon
      ["6-074", 80, 60], // Leopardmon
      ["6-075", 80, 60], // Leviamon
      ["6-076", 80, 60], // Lilithmon
      ["6-077", 80, 60], // LordKnightmon
      ["6-078", 80, 60], // Lotosmon
      ["6-079", 80, 60], // Lucemon: Satan Mode
      ["6-080", 88, 52], // Machinedramon
      ["6-081", 83, 67], // Magnadramon
      ["6-082", 83, 67], // Magnadramon X
      ["6-083", 83, 67], // MagnaGarurumon
      ["6-084", 83, 67], // Magnamon
      ["6-085", 80, 60], // MaloMyotismon
      ["6-086", 83, 67], // MarineAngemon
      ["6-087", 80, 60], // MegaGargomon
      ["6-088", 80, 60], // Megidramon
      ["6-089", 80, 60], // Megidramon X
      ["6-090", 88, 52], // MetalEtemon
      ["6-091", 88, 78], // MetalGarurumon
      ["6-092", 88, 52], // MetalGarurumon X
      ["6-093", 88, 52], // Metallicdramon
      ["6-094", 88, 52], // MetalPiranimon
      ["6-095", 88, 52], // MetalSeadramon
      ["6-096", 80, 60], // MirageGaogamon
      ["6-097", 80, 60], // Murmukusmon
      ["6-098", 80, 60], // Nidhoggmon
      ["6-099", 80, 60], // NoblePumpkinmon
      ["6-100", 83, 67], // Ophanimon
      ["6-101", 83, 67], // Ophanimon X
      ["6-102", 83, 67], // Ophanimon: Falldown Mode X
      ["6-103", 80, 60], // Ornismon
      ["6-104", 80, 60], // Ouryumon
      ["6-105", 80, 60], // Phoenixmon
      ["6-106", 80, 60], // Phoenixmon X
      ["6-107", 80, 60], // Piedmon
      ["6-108", 80, 60], // PlatinumNumemon
      ["6-109", 80, 60], // Plesiomon
      ["6-110", 80, 60], // Plesiomon X
      ["6-111", 80, 60], // PrinceMamemon X
      ["6-112", 80, 60], // Pukumon
      ["6-113", 80, 60], // Puppetmon
      ["6-114", 80, 60], // Rafflesimon
      ["6-115", 80, 60], // Raguelmon
      ["6-116", 80, 60], // Rapidmon X
      ["6-117", 80, 60], // Rasenmon
      ["6-118", 80, 60], // Rasenmon: Fury Mode
      ["6-119", 80, 60], // Rasielmon
      ["6-120", 80, 60], // Ravemon
      ["6-121", 80, 60], // Regalecusmon
      ["6-122", 80, 60], // Rhihimon
      ["6-123", 76, 64], // Rosemon
      ["6-124", 76, 64], // Rosemon X
      ["6-125", 92, 48], // RustTyrannomon
      ["6-126", 80, 60], // SaberLeomon
      ["6-127", 80, 60], // Sakuyamon X
      ["6-128", 83, 67], // Seraphimon
      ["6-129", 92, 48], // ShineGreymon
      ["6-130", 92, 48], // SkullMammothmon
      ["6-131", 92, 48], // SkullMammothmon X
      ["6-132", 83, 67], // SlashAngemon
      ["6-133", 80, 60], // Slayerdramon
      ["6-134", 80, 60], // Susanomon
      ["6-135", 80, 60], // TigerVespamon
      ["6-136", 80, 60], // Titamon
      ["6-137", 80, 60], // UlforceVeedramon
      ["6-138", 80, 60], // UltimateBrachiomon
      ["6-139", 80, 60], // Valkyrimon
      ["6-140", 80, 60], // Varodurumon
      ["6-141", 80, 60], // VenomMyotismon
      ["6-142", 80, 60], // Volcanicdramon
      ["6-143", 94, 62], // WarGreymon
      ["6-144", 92, 48], // WarGreymon X
      ["6-145", 80, 60], // Zhuqiaomon
      ["6-146", 80, 60], // Vikemon
      ["6-147", 80, 60], // ShinMonzaemon
      ["6-148", 80, 60], // Kazuchimon
      ["6-149", 80, 60], // BanchoLillymon
      ["6-150", 80, 60], // Dorugoramon
      ["7-001", 90, 65], // Alphamon: Ouryuken
      ["7-002", 90, 65], // Armageddemon
      ["7-003", 90, 65], // Barbamon X
      ["7-004", 90, 65], // Beelzemon X
      ["7-005", 90, 65], // Beelzemon: Blast Mode
      ["7-006", 90, 65], // Belphemon X
      ["7-007", 90, 65], // Boltboutamon
      ["7-008", 90, 65], // Chaosmon
      ["7-009", 90, 65], // Craniamon X
      ["7-010", 90, 65], // Creepymon X
      ["7-011", 90, 65], // DarknessBagramon
      ["7-012", 90, 65], // Diaboromon X
      ["7-013", 90, 65], // Dynasmon X
      ["7-014", 90, 65], // Examon
      ["7-015", 90, 65], // Examon X
      ["7-016", 90, 65], // Gallantmon X
      ["7-017", 90, 65], // Gankoomon X
      ["7-018", 90, 65], // GraceNovamon
      ["7-019", 90, 65], // Imperialdramon: Fighter Mode
      ["7-020", 90, 65], // Imperialdramon: Paladin Mode
      ["7-021", 90, 65], // Jesmon X
      ["7-022", 90, 65], // Kentaurosmon X
      ["7-023", 90, 65], // Leopardmon X
      ["7-024", 90, 65], // Leviamon X
      ["7-025", 90, 65], // Lilithmon X
      ["7-026", 90, 65], // LordKnightmon X
      ["7-027", 90, 65], // Lucemon X
      ["7-028", 93, 72], // Magnamon X
      ["7-029", 90, 65], // Mastemon
      ["7-030", 90, 65], // Minervamon X
      ["7-031", 90, 65], // Ogudomon
      ["7-032", 90, 65], // Omnimon
      ["7-033", 90, 65], // Omnimon Alter-S
      ["7-034", 90, 65], // Omnimon X
      ["7-035", 90, 65], // Ordinemon
      ["7-036", 90, 65], // Rafflesimon
      ["7-037", 90, 65], // RagnaLoardmon
      ["7-038", 90, 65], // Rasenmon
      ["7-039", 100, 53], // RustTyrannomon
      ["7-040", 90, 65], // UlforceVeedramon X
      ["7-041", 90, 65], // Agumon (Bond of Bravery)
      ["7-042", 90, 65], // Gabumon (Bond of Friendship)
      ["7-043", 90, 65], // Jesmon GX
      ["7-044", 90, 65], // Ogudomon X
      ["7-045", 90, 65], // Chaosdramon
    ] as const
  ).map(([id, strength, evasion]) => [id, validateCombatStats({ strength, evasion })]),
)
