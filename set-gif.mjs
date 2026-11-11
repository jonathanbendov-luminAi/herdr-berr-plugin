// Manage the GIF bank. Each strip plays a random GIF from it.
//   Popup (herdr pane):  node set-gif.mjs
//   Shell:               node set-gif.mjs list | add <path-or-url> | remove <n> | clear
import { createInterface } from "node:readline/promises";
import { have, loadConfig, resolveGif, saveConfig, configPath } from "./lib.mjs";

function list() {
  const { gifs } = loadConfig();
  if (!gifs.length) return console.log("  (empty: strips show the money counter only)");
  gifs.forEach((g, i) => console.log(`  ${String(i + 1).padStart(2)}. ${g}`));
}

function add(entry) {
  if (!have("ffmpeg")) console.log("warning: ffmpeg not found; GIFs need it (brew install ffmpeg chafa)");
  if (!resolveGif(entry)) return console.log(`could not read ${entry}: check the path, or that the URL downloads a GIF directly`);
  const { gifs } = loadConfig();
  if (gifs.includes(entry)) return console.log("already in the bank");
  saveConfig({ gifs: [...gifs, entry] });
  console.log(`added (#${gifs.length + 1})`);
}

function remove(n) {
  const { gifs } = loadConfig();
  const i = Number(n) - 1;
  if (!(i >= 0 && i < gifs.length)) return console.log(`no GIF #${n}`);
  const [gone] = gifs.splice(i, 1);
  saveConfig({ gifs });
  console.log(`removed ${gone}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "list") list();
else if (cmd === "add" && arg) add(arg);
else if (cmd === "remove" && arg) remove(arg);
else if (cmd === "clear") { saveConfig({ gifs: [] }); console.log("bank cleared"); }
else if (cmd) console.log("usage: node set-gif.mjs list | add <path-or-url> | remove <n> | clear");
else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    console.log("\x1b[2J\x1b[H\x1b[1mherdr-brrr GIF bank\x1b[0m: each working agent gets a random one\n");
    list();
    console.log(`\npaste a path or URL to add · -N to remove #N · Enter to close\n\x1b[2m${configPath}\x1b[0m`);
    const a = (await rl.question("> ")).trim();
    if (!a) break;
    if (/^-\d+$/.test(a)) remove(a.slice(1)); else add(a);
    await new Promise((r) => setTimeout(r, 900));
  }
  rl.close();
}
