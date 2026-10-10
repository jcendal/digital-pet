import type { SidebarCardInputs } from "@jcendal/digital-pet-core/application/models/sidebar-card-inputs.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import { IntlModule } from "../i18n.ts"

export const buildPartnerInputs = (catalog: DigimonCatalog, nodeId: string): SidebarCardInputs => {
  const node = catalog.byId.get(nodeId)
  if (node === undefined)
    throw new Error(IntlModule.translate("buildPartnerInputs.unknownDigimonNode", { nodeId: nodeId }))

  return {
    kind: "partner",
    node,
    gauge: 42,
    isTerminal: false,
    frozen: false,
    isSetOverride: false,
    trainerTotalTokens: 100,
    evolutionBattlePending: false,
  }
}
