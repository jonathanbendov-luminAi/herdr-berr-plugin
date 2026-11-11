// Runs inside the strip pane: loops the GIF frames via the Kitty graphics protocol.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const [agentPane = "?", agentName = "agent", mode = "blocks"] = process.argv.slice(2);
// blocks mode: 56x24 raw RGB frames drawn with upper-half blocks (works in any truecolor terminal)
const BW = 56, BH = 24;
const raw = readFileSync(join(root, "frames-56x24.rgb"));
const blockFrames = [];
for (let off = 0; off + BW * BH * 3 <= raw.length; off += BW * BH * 3) {
  const px = (x, y) => { const o = off + (y * BW + x) * 3; return `${raw[o]};${raw[o + 1]};${raw[o + 2]}`; };
  const lines = [];
  for (let y = 0; y < BH; y += 2) {
    let l = "";
    for (let x = 0; x < BW; x++) l += `\x1b[38;2;${px(x, y)}m\x1b[48;2;${px(x, y + 1)}m\u2580`;
    lines.push(l + "\x1b[0m");
  }
  blockFrames.push(lines);
}
const dir = join(root, "frames");
const files = mode !== "kitty" ? [] : readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
const frames = files.map((f) => readFileSync(join(dir, f)).toString("base64"));
const BASE = 4200; // image ids BASE+1..BASE+n
const out = process.stdout;
const esc = (s) => out.write(s);
const gfx = (ctrl, payload = "") => `\x1b_G${ctrl}${payload ? ";" + payload : ""}\x1b\\`;

function transmitAndPlace(id, b64, rows) {
  let s = "";
  for (let i = 0; i < b64.length; i += 4096) {
    const chunk = b64.slice(i, i + 4096);
    const more = i + 4096 < b64.length ? 1 : 0;
    s += i === 0 ? gfx(`a=T,f=100,i=${id},r=${rows},C=1,q=2,m=${more}`, chunk) : gfx(`m=${more}`, chunk);
  }
  return s;
}

const sent = new Set();
let prev = 0, i = 0, rows = 0, imgCols = 0;
const started = Date.now();

function layout() {
  rows = Math.max(3, (out.rows || 10) - 1);
  imgCols = Math.round(rows * 2 * (240 / 104)); // ~1:2 cell aspect
  esc("\x1b[2J" + gfx("a=d,d=a,q=2"));
  prev = 0;
}

// chafa mode: ANSI frames sized to this pane's width, built once per size and cached.
import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
const LABEL_W = 26, MAX_W = 74, ASPECT = 16 / 74;
const cacheDir = join(process.env.HERDR_PLUGIN_STATE_DIR || join(process.env.HOME, ".local/state/herdr-brrr"), "cache");
let chafaFrames = [], CW = 0, labelBelow = false;
function chafaSize() {
  const cols = out.columns || 80;
  labelBelow = cols - LABEL_W < 30;
  const w = Math.max(8, Math.min(MAX_W, labelBelow ? cols : cols - LABEL_W));
  const maxRows = Math.max(2, (out.rows || 17) - (labelBelow ? 3 : 1));
  const h = Math.max(2, Math.min(maxRows, Math.round(w * ASPECT)));
  return [Math.round(Math.min(w, h / ASPECT)), h];
}
// Size is chosen after the pane settles; a build only takes effect if its size is still wanted.
let wantKey = "", building = new Set(), settleTimer;
function loadChafa() {
  const [w, h] = chafaSize();
  const key = `${w}x${h}`;
  wantKey = key;
  const file = join(cacheDir, `${key}.ans`);
  const use = () => {
    if (wantKey !== key) return;
    chafaFrames = readFileSync(file, "utf8").split("\f").filter((f) => f.trim())
      .map((f) => f.replace(/\r/g, "").split("\n").filter((l) => l.length));
    CW = w;
    ci = 0;
    esc("\x1b[2J");
  };
  if (existsSync(file)) return use();
  chafaFrames = [];
  esc("\x1b[2J\x1b[H\x1b[2mwarming up the money printer…\x1b[0m");
  if (building.has(key)) return;
  building.add(key);
  mkdirSync(cacheDir, { recursive: true });
  spawn(join(root, "build-frames.sh"), [String(w), String(h), file], { stdio: "ignore" })
    .on("exit", () => { building.delete(key); if (existsSync(file)) use(); });
}
function scheduleLoad() { clearTimeout(settleTimer); settleTimer = setTimeout(loadChafa, 400); }
let ci = 0;
function tickChafa() {
  if (!chafaFrames.length) return;
  const f = chafaFrames[ci];
  ci = (ci + 1) % chafaFrames.length;
  esc(f.map((l, y) => `\x1b[${y + 1};1H${l}\x1b[0m\x1b[K`).join("") +
      (labelBelow ? label(0, f.length, f.length + 1) : label(CW, f.length)));
}
if (mode === "chafa") { scheduleLoad(); out.on("resize", () => { chafaFrames = []; esc("\x1b[2J"); scheduleLoad(); }); }

function tick() {
  if (mode === "chafa") return tickChafa();
  if (mode === "blocks") return tickBlocks();
  const id = BASE + 1 + i;
  let s = "\x1b[H";
  s += sent.has(id) ? gfx(`a=p,i=${id},r=${rows},C=1,q=2`) : transmitAndPlace(id, frames[i], rows);
  sent.add(id);
  if (prev && prev !== id) s += gfx(`a=d,d=i,i=${prev},q=2`);
  prev = id;
  i = (i + 1) % frames.length;
  esc(s + label(imgCols));
}

let bi = 0;
function tickBlocks() {
  const f = blockFrames[bi];
  bi = (bi + 1) % blockFrames.length;
  esc(f.map((l, y) => `\x1b[${y + 1};1H${l}`).join("") + label(BW));
}

function label(imgWidth, imgRows, atRow) {
  let s = "";
  const secs = Math.floor((Date.now() - started) / 1000);
  const t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const col = imgWidth ? imgWidth + 3 : 1;
  const mid = atRow ?? Math.max(1, Math.floor((imgRows ?? (mode === "blocks" ? BH / 2 : rows)) / 2));
  s += `\x1b[${mid};${col}H\x1b[1;32mmoney printer go brrr\x1b[0m\x1b[K`;
  s += `\x1b[${mid + 1};${col}H\x1b[2m${agentName} working · ${t}\x1b[0m\x1b[K`;
  return s;
}

function cleanup() {
  esc(gfx("a=d,d=A,q=2") + "\x1b[?25h\x1b[2J\x1b[H");
  process.exit(0);
}
for (const sig of ["SIGTERM", "SIGHUP", "SIGINT"]) process.on(sig, cleanup);
out.on("resize", layout);
esc("\x1b[?25l");
layout();
setInterval(tick, 1000 / 12);
