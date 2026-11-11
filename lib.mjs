// Shared config, GIF resolution, and strip sizing for hook.mjs / strip.mjs / set-gif.mjs.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const home = process.env.HOME;
export const stateDir = process.env.HERDR_PLUGIN_STATE_DIR || join(home, ".local/state/herdr-brrr");
export const configDir = process.env.HERDR_PLUGIN_CONFIG_DIR || join(home, ".config/herdr-brrr");
export const configPath = join(configDir, "config.json");
export const cacheDir = join(stateDir, "cache");
mkdirSync(cacheDir, { recursive: true });

export const DEFAULTS = {
  gifs: [], // bank of paths or http(s) URLs; each strip picks one at random. Empty = counter only
  title: "money printer go brrr",
  fps: 12,
  max_rows: 17, // tallest strip (including herdr's pane chrome)
};

export function loadConfig() {
  let cfg;
  try { cfg = { ...DEFAULTS, ...JSON.parse(readFileSync(configPath, "utf8")) }; } catch { cfg = { ...DEFAULTS }; }
  if (cfg.gif && !(cfg.gifs || []).some((e) => entryPath(e) === cfg.gif)) cfg.gifs = [...(cfg.gifs || []), cfg.gif]; // legacy single "gif"
  delete cfg.gif;
  cfg.gifs = (cfg.gifs || []).filter((e) => entryPath(e));
  return cfg;
}

// A bank entry is a path/URL string, or {"path": "...", "weight": 70} where weight is a
// percentage. Weighted entries get exactly that share; plain entries split what's left.
export const entryPath = (e) => (typeof e === "string" ? e : e?.path || "");
export const entryWeight = (e) => (typeof e === "object" && Number(e?.weight) > 0 ? Number(e.weight) : 0);

export function bankOdds(gifs) {
  const fixed = gifs.reduce((n, e) => n + entryWeight(e), 0);
  const plain = gifs.filter((e) => !entryWeight(e)).length;
  const rest = plain ? Math.max(0, 100 - fixed) / plain : 0;
  const w = gifs.map((e) => entryWeight(e) || rest);
  const total = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => (x / total) * 100);
}

// Weighted-random usable GIF from the bank (skips entries that can't be read), or "".
export function pickGif(cfg = loadConfig()) {
  const bank = [...cfg.gifs];
  while (bank.length) {
    const odds = bankOdds(bank);
    let r = Math.random() * 100, i = 0;
    while (i < bank.length - 1 && (r -= odds[i]) >= 0) i++;
    const [entry] = bank.splice(i, 1);
    const path = resolveGif(entryPath(entry));
    if (path) return path;
  }
  return "";
}

export function saveConfig(patch) {
  mkdirSync(configDir, { recursive: true });
  const next = { ...loadConfig(), ...patch };
  writeFileSync(configPath, JSON.stringify(next, null, 2) + "\n");
  return next;
}

export const have = (bin) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0;

// Returns a local GIF path (URLs are downloaded once into the cache), or "".
export function resolveGif(gif) {
  if (!gif) return "";
  if (/^https?:\/\//.test(gif)) {
    const file = join(cacheDir, "url-" + createHash("sha1").update(gif).digest("hex").slice(0, 12) + ".gif");
    if (!existsSync(file)) {
      const r = spawnSync("curl", ["-fsSL", "--max-time", "30", "-o", file, gif]);
      if (r.status !== 0) return "";
    }
    return file;
  }
  const p = gif.replace(/^~(?=\/)/, home);
  return existsSync(p) ? p : "";
}

// Stable id for a GIF's current contents, used to key render caches.
export function gifKey(path) {
  const s = statSync(path);
  return createHash("sha1").update(`${path}:${s.size}:${s.mtimeMs}`).digest("hex").slice(0, 10);
}

// Width/height after trimming black bars, cached per GIF.
export function gifInfo(path) {
  const key = gifKey(path);
  const file = join(cacheDir, `${key}.json`);
  try { return JSON.parse(readFileSync(file, "utf8")); } catch {}
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
    "-of", "csv=p=0", path], { encoding: "utf8" }).stdout.trim().split(",").map(Number);
  let [w, h] = probe;
  let crop = "";
  const det = spawnSync("ffmpeg", ["-i", path, "-vf", "cropdetect=24:2:0", "-f", "null", "-"], { encoding: "utf8" }).stderr || "";
  const counts = {};
  for (const m of det.matchAll(/crop=(\d+:\d+:\d+:\d+)/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (best) {
    const [cw, ch] = best.split(":").map(Number);
    if (cw > w * 0.5 && ch > h * 0.5 && (cw < w || ch < h)) { crop = best; w = cw; h = ch; }
  }
  const info = { key, width: w, height: h, crop };
  writeFileSync(file, JSON.stringify(info));
  return info;
}

// Layout for a strip inside a pane `cols` wide with `rows` content rows.
// Terminal cells are ~1:2, so an image w cells wide is w * (h/w) / 2 cells tall.
export const LABEL_W = 36;
export const LABEL_ROWS = 5;
export function layout(cols, rows, info) {
  if (!info) return { imgW: 0, imgH: 0, labelBelow: false, contentRows: LABEL_ROWS };
  const ratio = info.height / info.width / 2;
  const labelBelow = cols - LABEL_W < 30;
  const maxW = labelBelow ? cols : cols - LABEL_W - 2;
  const maxH = Math.max(2, rows - (labelBelow ? LABEL_ROWS : 0));
  let imgW = Math.max(8, maxW);
  let imgH = Math.round(imgW * ratio);
  if (imgH > maxH) { imgH = maxH; imgW = Math.round(imgH / ratio); }
  imgH = Math.max(2, imgH);
  return { imgW, imgH, labelBelow, contentRows: Math.max(LABEL_ROWS, imgH + (labelBelow ? LABEL_ROWS : 0)) };
}

// herdr pane chrome eats 2 rows of a split pane.
export const PANE_CHROME_ROWS = 2;
