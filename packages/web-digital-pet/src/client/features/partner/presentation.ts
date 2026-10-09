/** Serializes eating and evolution within a view; Web Locks guard competing views. */
let presenting = false
let revision = 0
export const isPresentingEvolution = (): boolean => presenting
export const cancelEvolutionPresentation = (): void => {
  revision++
}
export const presentationVersion = (): number => revision
export const presentationCurrent = (version: number): boolean => version === revision
export const beginPresentation = (): boolean => {
  if (presenting) return false
  presenting = true
  return true
}
export const endPresentation = (): void => {
  presenting = false
}
