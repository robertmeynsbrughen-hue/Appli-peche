#!/usr/bin/env node
// Rivio : tests automatiques de bout en bout (avant chaque mise en ligne).
// Un navigateur parcourt l'appli avec un faux Supabase (tests/mock-supabase.js)
// et échoue si un écran plante ou si un élément essentiel manque.
// Usage : node tests/smoke.mjs   (Playwright doit être installé)
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = join(root, p);
  if (!f.startsWith(root) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const BASE = "http://localhost:" + server.address().port + "/index.html";
const mock = readFileSync(join(root, "tests/mock-supabase.js"), "utf8");
const leaflet = readFileSync(join(root, "tests/leaflet-stub.js"), "utf8");

const browser = await chromium.launch();
const failures = [];
let passed = 0;
async function page(extraInit) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: "block" });
  await ctx.route("**/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
  await ctx.route("**/supabase.js", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route("**/leaflet.js", (r) => r.fulfill({ contentType: "text/javascript", body: leaflet }));
  await ctx.route(/open-meteo|googleapis|gstatic|cdnjs|unpkg|jsdelivr|geopf|rainviewer|hubeau|overpass|geo\.api|osrm|_t\//, (r) => r.abort());
  await ctx.addInitScript(() => {
    localStorage.setItem("cdj-tour-done", "1");
    ["u1", "u2", "u3", "u4", "u6"].forEach((u) => localStorage.setItem("cdj-onboard-" + u, "1"));
    localStorage.setItem("cdj-annonces-lues", "[9]");
    if (!localStorage.getItem("cdj-lang")) localStorage.setItem("cdj-lang", "fr");
    if (!localStorage.getItem("cdj-grp")) localStorage.setItem("cdj-grp", "2");   // groupe « Float-tube 47 » du faux Supabase
    if (!sessionStorage.getItem("v")) { sessionStorage.setItem("v", "1"); localStorage.setItem("cdj-version-vue", "9.99"); }
  });
  if (extraInit) await ctx.addInitScript(extraInit);
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(String(e).slice(0, 300)));
  return p;
}
async function test(name, fn) {
  const p = await page();
  try {
    await fn(p);
    if (p.errs.length) throw new Error("erreur JavaScript : " + p.errs.join(" | "));
    passed++; console.log("  ✓ " + name);
  } catch (e) {
    failures.push(name); console.log("  ✗ " + name + "\n      " + String(e.message || e).split("\n")[0]);
  } finally { await p.context().close(); }
}
const must = async (p, sel, what) => { if (!(await p.$(sel))) throw new Error((what || sel) + " introuvable"); };
const go = async (p, q, hash, ms = 2200) => { await p.goto(BASE + q + hash); await p.waitForTimeout(ms); };

console.log("Rivio · tests de bout en bout");

await test("visiteur sans compte : écran Aujourd'hui", async (p) => {
  await go(p, "?nosession=1", "#conseils");
  await must(p, "#v-conseils:not([hidden])", "l'écran Aujourd'hui");
});
await test("membre : Aujourd'hui, Fil, Carte, Groupe, Profil", async (p) => {
  await go(p, "?as=bob", "#conseils");
  for (const v of ["fil", "carte", "groupe", "profil"]) {
    await p.evaluate((h) => { location.hash = "#" + h; }, v); await p.waitForTimeout(900);
    await must(p, "#v-" + v + ":not([hidden])", "l'écran " + v);
  }
  await must(p, "#feed .post", "une publication du fil");
});
await test("fil : bouton Nouvelle prise et formulaire", async (p) => {
  await go(p, "?as=bob", "#fil");
  await p.click(".st-toggle"); await p.click('#post-mode [data-m="post"]'); await p.waitForTimeout(200);
  await must(p, "#composer:not([hidden])", "le formulaire de prise");
});
await test("chat : menu d'un message et messages privés", async (p) => {
  await go(p, "?as=bob", "#chat", 2600);
  await p.click("#chat-msgs .msg:not(.mine) .bubble"); await must(p, ".msg-menu", "le menu du message");
  await p.click(".chat-dm-btn"); await p.waitForTimeout(500); await must(p, ".dm-row", "une conversation privée");
});
await test("profil : sous-onglets Moi, Collection, Outils, Réglages", async (p) => {
  await go(p, "?as=bob", "#profil");
  for (const s of ["moi", "collection", "matos", "reglages"]) {
    const b = await p.$('#profil-sub [data-s="' + s + '"]'); if (!b) continue;
    await b.click(); await p.waitForTimeout(500);
  }
  await must(p, "#bug-panel", "le panneau Signaler un bug");
  await must(p, "#data-panel", "le panneau Mes données");
});
await test("groupe Bienvenue : questions-réponses et parrainage", async (p) => {
  await go(p, "?as=bob", "#fil");
  await p.evaluate(() => { window.CDJ.setGroup(13); location.hash = "#groupe"; }); await p.waitForTimeout(2000);
  await must(p, ".qa-sec", "les questions-réponses"); await must(p, ".mentor-sec", "le parrainage");
});
await test("développeur : modération complète", async (p) => {
  await go(p, "?as=Roby_Admin", "#profil");
  await p.evaluate(() => document.querySelector('#profil-sub [data-s="moderation"]')?.click()); await p.waitForTimeout(3000);
  for (const id of ["mod-todo", "mod-members", "mod-journal", "mod-annonces", "mod-sante", "mod-bugs", "mod-stats", "mod-sauvegardes", "mod-maintenance"]) await must(p, "#" + id, "la section " + id);
});
await test("mode maintenance : écran d'attente pour un membre", async (p) => {
  await go(p, "?as=bob&maint=1", "#fil");
  await must(p, "#maint-ov", "l'écran de maintenance");
});
await test("version anglaise : écrans principaux traduits", async (p) => {
  await p.goto(BASE + "?as=bob#conseils"); await p.evaluate(() => localStorage.setItem("cdj-lang", "en")); await p.reload(); await p.waitForTimeout(2600);
  const nav = await p.evaluate(() => [...document.querySelectorAll("nav.tabs a")].map((a) => a.textContent.trim()).join(" "));
  if (!/Today/.test(nav) || !/Feed/.test(nav)) throw new Error("barre de navigation non traduite : " + nav);
  await p.evaluate(() => localStorage.setItem("cdj-lang", "fr"));
});
await test("lien d'invitation sans compte", async (p) => {
  await go(p, "?nosession=1&invite=" + "T".repeat(32), "#conseils");
  await must(p, "#invite-note", "le message d'invitation");
});

await test("0.77 : session en direct, planning des postes, étangs", async (p) => {
  await go(p, "?as=bob", "#conseils", 2800);
  await must(p, "#carp-live-conseils .carp-live", "la carte « En direct » de la session carpe de marco_47");
  await p.evaluate(() => { window.CDJ.hooks.spotSheet(window.CDJ.spots.find((s) => s.id === 5)); }); await p.waitForTimeout(800);
  await must(p, "#spot-sheet .postes .postes-list li", "la réservation de poste sur la fiche");
  await p.evaluate(() => { document.querySelector("#spot-sheet .icon-btn")?.click(); location.hash = "#groupe"; }); await p.waitForTimeout(1500);
  await must(p, ".g-postes .postes-list li", "les postes réservés du groupe");
  await p.evaluate(() => { location.hash = "#carte"; }); await p.waitForTimeout(1200);
  const has = await p.evaluate(() => [...document.querySelectorAll("#map-layers button")].some((b) => /Étangs/.test(b.textContent)));
  if (!has) throw new Error("le bouton Étangs introuvable");
});

await test("0.77 : import d'un fichier de sondeur", async (p) => {
  await go(p, "?as=bob", "#carte", 2600);
  await p.evaluate(() => document.querySelector('#carte-sub [data-s="fond"]')?.click()); await p.waitForTimeout(900);
  const rows = ["latitude;longitude;depth (m)"]; for (let i = 0; i < 400; i++) rows.push((44.2 + (i % 20) * 0.0002).toFixed(6) + ";" + (0.6 + Math.floor(i / 20) * 0.0002).toFixed(6) + ";" + (1 + (i % 20) * 0.3).toFixed(1).replace(".", ","));
  await p.setInputFiles('#fond-panel input[type=file]', { name: "deeper.csv", mimeType: "text/csv", buffer: Buffer.from(rows.join("\n")) });
  await p.waitForTimeout(600); await must(p, ".sonar-import", "l'aperçu de l'import");
  await p.click(".sonar-import .btn.primary"); await p.waitForTimeout(1200);
  await must(p, "#fond-panel ul.imports li", "l'import dans « Mes imports »");
});

await browser.close(); server.close();
console.log("\n" + passed + " test(s) réussi(s), " + failures.length + " échec(s)");
process.exit(failures.length ? 1 : 0);
