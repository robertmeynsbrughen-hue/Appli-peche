#!/usr/bin/env node
// Rivio : écrit .well-known/assetlinks.json, qui prouve à Android que le site
// et l'appli app.rivio appartiennent au même éditeur (plein écran, sans barre
// d'adresse). Il faut DEUX empreintes SHA-256 : la clé d'envoi (affichée par le
// workflow Android) et la clé de signature de Google (Play Console › Intégrité
// de l'appli › Signature de l'appli). Ce sont des empreintes publiques.
// Usage : node android/assetlinks.mjs AA:BB:… CC:DD:…
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fps = process.argv.slice(2).map((s) => s.trim().toUpperCase());
const ok = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
if (!fps.length || fps.some((f) => !ok.test(f))) { console.error("Donne une ou deux empreintes SHA-256 au format AA:BB:…"); process.exit(1); }
const json = [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "app.rivio", sha256_cert_fingerprints: [...new Set(fps)] } }];
mkdirSync(join(root, ".well-known"), { recursive: true });
writeFileSync(join(root, ".well-known/assetlinks.json"), JSON.stringify(json, null, 2) + "\n");
console.log(".well-known/assetlinks.json écrit avec " + fps.length + " empreinte(s).");
