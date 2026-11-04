#!/usr/bin/env node
// Rivio : fabrique android/twa-manifest.json (Bubblewrap) à partir de la version
// de l'appli et de l'adresse du site. Aucun secret ici : la clé de signature
// reste dans les secrets GitHub du dépôt.
// Usage : node android/twa-manifest.mjs <hôte> <chemin de base>
//   ex. : node android/twa-manifest.mjs rivio.fr /
//         node android/twa-manifest.mjs robertmeynsbrughen-hue.github.io /Appli-peche/
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const host = (process.argv[2] || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
let base = (process.argv[3] || "/").trim();
if (!host || !/^[a-z0-9.-]+$/i.test(host)) { console.error("Hôte invalide : " + host); process.exit(1); }
if (!base.startsWith("/")) base = "/" + base;
if (!base.endsWith("/")) base += "/";

const version = readFileSync(join(root, "VERSION"), "utf8").trim();
const m = version.match(/^0\.(\d+)(?:\.(\d+))?$/);
if (!m) { console.error("VERSION illisible : " + version); process.exit(1); }
// 0.78 → 7800, 0.78.1 → 7801 : toujours croissant tant que le correctif reste < 100.
const code = Number(m[1]) * 100 + Number(m[2] || 0);
const web = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));
const url = (p) => "https://" + host + base + p.replace(/^\.?\//, "");

const twa = {
  packageId: "app.rivio",
  host,
  name: web.name,
  launcherName: web.short_name,
  display: "standalone",
  orientation: web.orientation || "portrait",
  themeColor: web.theme_color,
  themeColorDark: web.background_color,
  navigationColor: web.background_color,
  navigationColorDark: web.background_color,
  navigationDividerColor: web.background_color,
  navigationDividerColorDark: web.background_color,
  backgroundColor: web.background_color,
  enableNotifications: true,
  startUrl: base + web.start_url.replace(/^\.?\//, ""),
  iconUrl: url("icon-512.png"),
  maskableIconUrl: url("icon-maskable-512.png"),
  splashScreenFadeOutDuration: 300,
  signingKey: { path: "./rivio-upload.keystore", alias: "rivio" },
  appVersionCode: code,
  appVersion: version,
  shortcuts: (web.shortcuts || []).map((s) => ({ name: s.name, shortName: s.short_name || s.name, url: url(s.url), chosenIconUrl: url(s.icons?.[0]?.src || "icon-192.png") })),
  generatorApp: "bubblewrap-cli",
  webManifestUrl: url("manifest.webmanifest"),
  fallbackType: "customtabs",
  features: { locationDelegation: { enabled: true } },
  enableSiteSettingsShortcut: true,
  isChromeOSOnly: false,
  isMetaQuest: false,
  fullScopeUrl: url(""),
  minSdkVersion: 24,
  shareTarget: web.share_target ? {
    action: base + web.share_target.action.replace(/^\.?\//, ""),
    method: web.share_target.method,
    enctype: web.share_target.enctype,
    params: web.share_target.params,
  } : undefined,
  alphaDependencies: { enabled: false },
  retainedBundles: [],
};
writeFileSync(join(root, "android/twa-manifest.json"), JSON.stringify(twa, null, 2) + "\n");
console.log("android/twa-manifest.json : " + twa.packageId + " " + version + " (code " + code + ") pour https://" + host + base);
