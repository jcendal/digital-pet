import { PANEL_SCRIPT_HELPERS } from "../../shared/panel-script.ts"
import source from "./dex-client.browser.js" with { type: "text" }

export const DEX_SCRIPT = `${PANEL_SCRIPT_HELPERS}
${source}`
