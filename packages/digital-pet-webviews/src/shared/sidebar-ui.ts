import { IntlModule } from "../i18n.ts"
export const MIN_ARTWORK_WIDTH = 16
export const DEFAULT_ARTWORK_WIDTH = 32

export const nextCheckPrefix = (): string => IntlModule.translate("sidebarUi.nextCheck")
export const NEXT_CHECK_BAR_WIDTH = 20
export const sidebarUrlLabel = (): string => IntlModule.translate("sidebarUi.encyclopediaEntry")
