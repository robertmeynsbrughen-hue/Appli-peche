#!/usr/bin/env node
/**
 * Rivio : verifications automatiques (CI et local).
 *
 * 1. Syntaxe de tous les fichiers JavaScript (node --check).
 * 2. Coherence du numero de version entre VERSION, index.html, JOURNAL.md et sw.js.
 *
 * Usage : node tools/check.mjs
 * Sortie : code 0 si tout est bon, 1 sinon.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, sep } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const IGNORED_DIRS = new Set([".git", "node_modules", ".secrets", "dist", "build"]);

const problems = [];

/* ------------------------------------------------------------------ */
/* 1. Syntaxe JavaScript                                              */
/* ------------------------------------------------------------------ */

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if ([".js", ".mjs", ".cjs"].includes(extname(entry))) out.push(full);
  }
  return out;
}

const scripts = walk(ROOT).sort();
for (const file of scripts) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    const rel = relative(ROOT, file).split(sep).join("/");
    const detail = (result.stderr || result.stdout || "").trim().split("\n").slice(0, 4).join("\n    ");
    problems.push(`Syntaxe invalide : ${rel}\n    ${detail}`);
  }
}

/* ------------------------------------------------------------------ */
/* 2. Coherence des versions                                          */
/* ------------------------------------------------------------------ */

const read = (file) => readFileSync(join(ROOT, file), "utf8");

let version = null;
try {
  version = read("VERSION").trim();
} catch {
  problems.push("Fichier VERSION introuvable.");
}

if (version) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) {
    problems.push(`VERSION "${version}" ne respecte pas le format 0.xx ou 0.xx.x.`);
  }

  const index = read("index.html");
  const shown = (index.match(/id="app-version"[^>]*>([^<]*)</) || [])[1];
  if (shown === undefined) {
    problems.push('index.html : element <span id="app-version"> introuvable.');
  } else if (shown.trim() !== version) {
    problems.push(`index.html affiche "${shown.trim()}" alors que VERSION vaut "${version}".`);
  }

  const journal = read("JOURNAL.md");
  if (!journal.includes(version)) {
    problems.push(`JOURNAL.md ne mentionne pas la version "${version}".`);
  }

  const sw = read("sw.js");
  const cache = (sw.match(/const\s+VERSION\s*=\s*["']([^"']+)["']/) || [])[1];
  if (!cache) {
    problems.push("sw.js : constante VERSION introuvable.");
  } else if (!/^cdj-v\d+$/.test(cache)) {
    problems.push(`sw.js : VERSION "${cache}" ne respecte pas le format cdj-vN.`);
  }
}

/* ------------------------------------------------------------------ */
/* Rapport                                                            */
/* ------------------------------------------------------------------ */

if (problems.length === 0) {
  console.log(`OK : ${scripts.length} fichiers JavaScript valides, version ${version} coherente.`);
  process.exit(0);
}

console.error(`\n${problems.length} probleme(s) detecte(s) :\n`);
for (const p of problems) console.error(`- ${p}\n`);
process.exit(1);
