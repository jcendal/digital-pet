/** Themed game assignments inspired by Adventure, Frontier and their films; not canonical habitats.
 * Series: https://lineup.toei-anim.co.jp/ja/tv/dejimon/episode/
 * Frontier: https://lineup.toei-anim.co.jp/ja/tv/digimon_4th/episode/
 */
export const REGION_BOSS_IDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "gear-savannah": ["5-039", "6-090"], // Etemon, MetalEtemon
  "digital-ocean": ["6-095", "6-017"], // MetalSeadramon, Armageddemon
  wasteland: ["5-126", "6-014"], // SkullGreymon, Apocalymon
  "digital-forest": ["6-113", "6-077"], // Puppetmon, LordKnightmon
  "digital-city": ["6-080", "6-049"], // Machinedramon, Eosmon
  "village-of-beginnings": ["4-028", "5-067"], // Devimon, Lucemon: Chaos Mode
  "ancient-dino-region": ["5-106", "6-045"], // Parrotmon, Dynasmon
  "tropical-jungle": ["6-103", "6-097"], // Ornismon, Murmukusmon
  "vamdemon-castle": ["5-098", "6-141"], // Myotismon, VenomMyotismon
  "upside-down-pyramid": ["6-107", "6-079"], // Piedmon, Lucemon: Satan Mode
})
