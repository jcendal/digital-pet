import { IntlModule } from "../../i18n.ts"
export const TRAINER_STATE_SELECT = "SELECT total_tokens FROM trainer_state WHERE trainer_id = 1"
export const CONTROL_STATE_SELECT = "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1"
export const unavailableArchiveMessage = () => IntlModule.translate("sqlite.digitalPetArchiveIsUnavailable")
