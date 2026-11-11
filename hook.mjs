// Event hook: open a strip under an agent pane when it starts working, close it otherwise.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { configDir, gifInfo, have, layout, loadConfig, pickGif, stateDir, PANE_CHROME_ROWS } from "./lib.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const herdr = process.env.HERDR_BIN_PATH || "herdr";
const mapPath = join(stateDir, "strips.json");
const lockDir = join(stateDir, "lock");
const MIN_AGENT_ROWS = 18;

if (existsSync(join(stateDir, "disabled"))) process.exit(0);

let event = {};
try { event = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON || "{}"); } catch {}
const d = event.data ?? {};
const kind = process.env.HERDR_PLUGIN_EVENT || event.event || "";
const paneId = d.pane_id ?? d.pane?.pane_id;
if (!paneId) process.exit(0);

function run(args) {
  const r = spawnSync(herdr, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`herdr ${args.join(" ")}: ${r.stderr}`);
  return r.stdout ? JSON.parse(r.stdout) : {};
}
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Kitty images only render when herdr's client runs inside a Kitty-graphics terminal.
// Override by writing kitty|chafa|blocks|none to <state>/mode.
function renderMode(hasGif) {
  if (!hasGif) return "none";
  try {
    const m = readFileSync(join(stateDir, "mode"), "utf8").trim();
    if (["kitty", "chafa", "blocks", "none"].includes(m)) return m;
  } catch {}
  if (!have("ffmpeg")) return "none";
  const r = spawnSync("ps", ["-A", "-o", "pid=,ppid=,comm="], { encoding: "utf8" });
  const procs = new Map();
  for (const line of (r.stdout || "").split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (m) procs.set(m[1], { ppid: m[2], comm: m[3] });
  }
  for (const p of procs.values()) {
    if (!/(^|\/)herdr$/.test(p.comm)) continue;
    for (let cur = p, n = 0; cur && n < 20; cur = procs.get(cur.ppid), n++)
      if (/ghostty|kitty|wezterm/i.test(cur.comm)) return "kitty";
  }
  return have("chafa") ? "chafa" : "blocks";
}

// Serialize hooks: status events arrive in bursts.
let locked = false;
for (let i = 0; i < 100 && !locked; i++) {
  try { mkdirSync(lockDir); locked = true; } catch { sleep(50); }
}
if (!locked) { try { rmdirSync(lockDir); mkdirSync(lockDir); locked = true; } catch { process.exit(0); } }

try {
  const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : {};
  const snap = run(["api", "snapshot"]).result.snapshot;
  const live = new Set(snap.panes.map((p) => p.pane_id));
  for (const [a, s] of Object.entries(map)) if (!live.has(a) || !live.has(s)) {
    if (live.has(s)) try { run(["pane", "close", s]); } catch {}
    delete map[a];
  }
  const isStrip = Object.values(map).includes(paneId);
  const status = String(d.agent_status ?? "").toLowerCase();

  if (!isStrip && live.has(paneId) && kind.includes("agent_status") && status === "working" && !map[paneId]) {
    const cfg = loadConfig();
    const gif = pickGif(cfg);
    const mode = renderMode(Boolean(gif));
    const info = gif && mode !== "none" ? gifInfo(gif) : null;
    const agent = snap.agents.find((a) => a.pane_id === paneId);
    const lay = run(["pane", "layout", "--pane", paneId]).result.layout;
    const rect = lay.panes.find((p) => p.pane_id === paneId)?.rect;
    if (rect && !lay.zoomed) {
      const maxContent = Math.max(3, Number(cfg.max_rows) - PANE_CHROME_ROWS);
      const stripRows = layout(rect.width, maxContent, info).contentRows + PANE_CHROME_ROWS;
      if (rect.height >= MIN_AGENT_ROWS + stripRows) {
        const ratio = (1 - stripRows / rect.height).toFixed(3);
        const strip = run(["pane", "split", paneId, "--direction", "down", "--ratio", ratio, "--no-focus", "--cwd", root])
          .result.pane.pane_id;
        const env = `HERDR_PLUGIN_STATE_DIR=${shq(stateDir)} HERDR_PLUGIN_CONFIG_DIR=${shq(configDir)} BRRR_GIF=${shq(info ? gif : "")}`;
        run(["pane", "run", strip, `clear; ${env} exec node strip.mjs ${paneId} ${shq(agent?.agent ?? "agent")} ${mode}`]);
        map[paneId] = strip;
      }
    }
  } else if (!isStrip && map[paneId] && (kind.includes("closed") || status !== "working")) {
    try { run(["pane", "close", map[paneId]]); } catch {}
    delete map[paneId];
  }
  writeFileSync(mapPath, JSON.stringify(map));
} finally {
  rmdirSync(lockDir);
}
