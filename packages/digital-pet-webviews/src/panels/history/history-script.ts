import { PANEL_SCRIPT_HELPERS } from "../../shared/panel-script.ts"
import source from "./history-client.browser.js" with { type: "text" }

export const HISTORY_SCRIPT = `${PANEL_SCRIPT_HELPERS}
${source}`
