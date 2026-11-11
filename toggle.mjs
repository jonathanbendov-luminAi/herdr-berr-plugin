import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const stateDir = process.env.HERDR_PLUGIN_STATE_DIR || join(process.env.HOME, ".local/state/herdr-brrr");
mkdirSync(stateDir, { recursive: true });
const flag = join(stateDir, "disabled");
if (existsSync(flag)) { rmSync(flag); console.log("brrr strip enabled"); }
else { writeFileSync(flag, ""); console.log("brrr strip disabled (open strips close when their agents finish)"); }
