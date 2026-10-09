/** Semantic animation phases; each frontend chooses its own layout and styling. */
export type PresentationState =
  | { readonly phase: "idle" }
  | { readonly phase: "battle"; readonly fromNodeId: string; readonly opponentNodeId: string }
  | { readonly phase: "evolving" | "evolved"; readonly fromNodeId: string; readonly toNodeId: string }
  | { readonly phase: "defeated" | "draw" | "feeding"; readonly fromNodeId: string }

export type PresentationStateListener = (state: PresentationState) => Promise<void>
