import indicators from "../shared/care-indicators.browser.js" with { type: "text" }
import adventure from "./adventure-client.browser.js" with { type: "text" }
import source from "./sidebar-client.browser.js" with { type: "text" }

export const SIDEBAR_SCRIPT = `${indicators}\n${adventure}\n${source}`
