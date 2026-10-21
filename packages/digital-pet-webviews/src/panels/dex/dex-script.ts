import indicators from "../../shared/care-indicators.browser.js" with { type: "text" }
import { PANEL_SCRIPT_HELPERS } from "../../shared/panel-script.ts"
import source from "./dex-client.browser.js" with { type: "text" }

export const DEX_SCRIPT = `${indicators}\n${PANEL_SCRIPT_HELPERS}
${source}`
