// Runs inside the strip pane: plays the configured GIF (if any) next to a very
// serious AI money counter. Usage: node strip.mjs <agent-pane-id> <agent-name> <mode>
//   mode: kitty | chafa | blocks | none
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheDir, gifInfo, layout, loadConfig, stateDir, LABEL_ROWS } from "./lib.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const [, agentName = "agent", requestedMode = "none"] = process.argv.slice(2);
const out = process.stdout;
const esc = (s) => out.write(s);
const cfg = loadConfig();
const gif = process.env.BRRR_GIF && existsSync(process.env.BRRR_GIF) ? process.env.BRRR_GIF : ""; // chosen by hook.mjs
const info = gif ? gifInfo(gif) : null;
const mode = info ? requestedMode : "none";
const fps = Math.max(1, Math.min(30, Number(cfg.fps) || 12));

// ---------- money ledger: cumulative agent-working seconds across all runs ----------
const ledgerPath = join(stateDir, "ledger.json");
const readLedger = () => { try { return JSON.parse(readFileSync(ledgerPath, "utf8")).seconds || 0; } catch { return 0; } };
const baseSeconds = readLedger();
const started = Date.now();
const SPENT_PER_SEC = 2_700_000; // capex, vibes-adjusted
const MADE_PER_SEC = 0.07;       // revenue, optimistic
const QUIPS = [
  "ROI: soon™", "investors: still bullish", "GPUs go brrr", "tokens in, vibes out",
  "burn rate: yes", "profitable by 2031 (maybe)", "it's not a bubble, it's a platform",
  "the fed approves", "AGI is 6 months away", "have you tried more parameters?",
  "unit economics: vibes", "next round: series Ω",
];
const usd = (n) => "$" + Math.floor(n).toLocaleString("en-US");
const cents = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function labelLines() {
  const runSecs = (Date.now() - started) / 1000;
  const total = baseSeconds + runSecs;
  const m = Math.floor(runSecs / 60), s = Math.floor(runSecs % 60);
  return [
    `\x1b[1;32m${cfg.title}\x1b[0m`,
    `\x1b[2m${agentName} working · ${m}:${String(s).padStart(2, "0")}\x1b[0m`,
    `\x1b[31mspent on AI  ${usd(total * SPENT_PER_SEC)}\x1b[0m`,
    `\x1b[32mmade from AI ${cents(total * MADE_PER_SEC)}\x1b[0m`,
    `\x1b[3;33m${QUIPS[Math.floor(Date.now() / 5000) % QUIPS.length]}\x1b[0m`,
  ];
}

function drawLabel(col, row) {
  esc(labelLines().map((l, i) => `\x1b[${row + i};${col}H${l}\x1b[K`).join(""));
}

// ---------- image renderers ----------
let L = layout(out.columns || 80, out.rows || 15, info);
let frames = [], fi = 0, wantKey = "", pending = new Set(), settle;

function build(fmt, file, cols, rows, done) {
  if (pending.has(file)) return;
  pending.add(file);
  spawn(join(root, "build-frames.sh"), [gif, info.crop, String(fps), String(cols), String(rows), fmt, file], { stdio: "ignore" })
    .on("exit", () => { pending.delete(file); if (existsSync(file)) done(); });
}

function load() {
  L = layout(out.columns || 80, out.rows || 15, info);
  frames = [];
  esc("\x1b[2J");
  if (mode === "none") return;
  const key = `${info.key}-${mode}-${L.imgW}x${L.imgH}-${fps}`;
  wantKey = key;
  const file = join(cacheDir, key + (mode === "chafa" ? ".ans" : mode === "blocks" ? ".rgb" : ""));
  const use = () => {
    if (wantKey !== key) return;
    if (mode === "chafa") {
      frames = readFileSync(file, "utf8").split("\f").filter((f) => f.trim())
        .map((f) => f.replace(/\r/g, "").split("\n").filter((l) => l.length));
    } else if (mode === "blocks") {
      const raw = readFileSync(file), w = L.imgW, h = L.imgH * 2, size = w * h * 3;
      for (let off = 0; off + size <= raw.length; off += size) {
        const px = (x, y) => { const o = off + (y * w + x) * 3; return `${raw[o]};${raw[o + 1]};${raw[o + 2]}`; };
        const lines = [];
        for (let y = 0; y < h; y += 2) {
          let l = "";
          for (let x = 0; x < w; x++) l += `\x1b[38;2;${px(x, y)}m\x1b[48;2;${px(x, y + 1)}m▀`;
          lines.push(l);
        }
        frames.push(lines);
      }
    } else if (mode === "kitty") {
      frames = readdirSync(file).filter((f) => f.endsWith(".png")).sort()
        .map((f) => ({ b64: readFileSync(join(file, f)).toString("base64"), sent: false }));
      esc("\x1b_Ga=d,d=A,q=2\x1b\\");
    }
    fi = 0;
    esc("\x1b[2J");
  };
  if (existsSync(file)) return use();
  esc("\x1b[H\x1b[2mwarming up the money printer…\x1b[0m");
  build(mode === "chafa" ? "chafa" : mode === "blocks" ? "rgb" : "png", file, L.imgW, L.imgH, use);
}
const scheduleLoad = () => { clearTimeout(settle); settle = setTimeout(load, 400); };

const KITTY_BASE = 4200;
let kittyPrev = 0;
function kittyFrame(i) {
  const id = KITTY_BASE + 1 + i, f = frames[i];
  let s = "\x1b[H";
  if (!f.sent) {
    for (let o = 0; o < f.b64.length; o += 4096) {
      const more = o + 4096 < f.b64.length ? 1 : 0, chunk = f.b64.slice(o, o + 4096);
      s += o === 0 ? `\x1b_Ga=T,f=100,i=${id},c=${L.imgW},r=${L.imgH},C=1,q=2,m=${more};${chunk}\x1b\\` : `\x1b_Gm=${more};${chunk}\x1b\\`;
    }
    f.sent = true;
  } else s += `\x1b_Ga=p,i=${id},c=${L.imgW},r=${L.imgH},C=1,q=2\x1b\\`;
  if (kittyPrev && kittyPrev !== id) s += `\x1b_Ga=d,d=i,i=${kittyPrev},q=2\x1b\\`;
  kittyPrev = id;
  return s;
}

function tick() {
  if (frames.length) {
    if (mode === "kitty") esc(kittyFrame(fi));
    else esc(frames[fi].map((l, y) => `\x1b[${y + 1};1H${l}\x1b[0m\x1b[K`).join(""));
    fi = (fi + 1) % frames.length;
  }
  const imgRows = mode === "none" ? 0 : L.imgH;
  if (mode === "none" || L.labelBelow) drawLabel(1, imgRows + 1);
  else drawLabel(L.imgW + 3, Math.max(1, Math.floor((imgRows - LABEL_ROWS) / 2) + 1));
}

function cleanup() {
  const runSecs = (Date.now() - started) / 1000;
  try { writeFileSync(ledgerPath, JSON.stringify({ seconds: readLedger() + runSecs })); } catch {}
  esc("\x1b_Ga=d,d=A,q=2\x1b\\\x1b[?25h\x1b[2J\x1b[H");
  process.exit(0);
}
for (const sig of ["SIGTERM", "SIGHUP", "SIGINT"]) process.on(sig, cleanup);
out.on("resize", () => { frames = []; esc("\x1b[2J"); scheduleLoad(); });
esc("\x1b[?25l\x1b[2J");
scheduleLoad();
setInterval(tick, 1000 / fps);
