import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "./lib.mjs";
const flag = join(stateDir, "disabled");
if (existsSync(flag)) { rmSync(flag); console.log("brrr strip enabled"); }
else { writeFileSync(flag, ""); console.log("brrr strip disabled (open strips close when their agents finish)"); }
