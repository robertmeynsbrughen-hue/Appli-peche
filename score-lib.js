// Rivio : moteur de score des espèces, version serveur (alerte du matin).
// Même logique que advice.js, sans affichage.
export const SPECIES = [
  { id: "brochet", name: "Brochet", t: [4, 8, 18, 23], light: { aube: 1, jour: .72, crep: 1, nuit: .25 } },
  { id: "sandre", name: "Sandre", t: [6, 10, 22, 26], light: { aube: 1, jour: .4, crep: 1, nuit: .85 } },
  { id: "perche", name: "Perche", t: [6, 10, 24, 28], light: { aube: .8, jour: 1, crep: .85, nuit: .15 } },
  { id: "bass", name: "Black-bass", t: [10, 16, 28, 32], light: { aube: .95, jour: .8, crep: 1, nuit: .2 } },
  { id: "silure", name: "Silure", t: [8, 14, 26, 30], light: { aube: .9, jour: .55, crep: 1, nuit: 1 } },
  { id: "carpe", name: "Carpe", t: [8, 14, 26, 30], light: { aube: .95, jour: .7, crep: .9, nuit: .95 } },
  { id: "chevesne", name: "Chevesne", t: [4, 10, 22, 27], light: { aube: .9, jour: .85, crep: .9, nuit: .2 } },
];
const CLOSED = { brochet: (m) => m >= 2 && m <= 4, sandre: (m) => m >= 2 && m <= 4, bass: (m) => m >= 2 && m <= 4 };

function phase(h, rise, set) {
  if (h >= rise - 1 && h < rise + 1.5) return "aube";
  if (h >= set - 1.5 && h < set + 1) return "crep";
  if (h >= rise + 1.5 && h < set - 1.5) return "jour";
  return "nuit";
}
function tempScore(t, [mn, lo, hi, mx]) {
  if (t >= lo && t <= hi) return 1;
  if (t < lo) return t <= mn ? 0.08 : 0.2 + 0.8 * (t - mn) / (lo - mn);
  return t >= mx ? 0.08 : 0.2 + 0.8 * (mx - t) / (mx - hi);
}
export function scoreHour(sp, c, waterType) {
  let light = sp.light[c.phase];
  const cloudy = c.cloud >= 65, rainy = c.rain >= 0.3;
  if (c.phase === "jour" && (cloudy || rainy)) {
    if (sp.id === "brochet") light = .9;
    if (sp.id === "sandre") light = .65;
    if (sp.id === "carpe") light = .8;
    if (sp.id === "silure") light = .7;
  }
  if (sp.id === "carpe" && c.phase === "jour" && c.water < 11 && !cloudy) light = .85;
  let s = tempScore(c.water, sp.t) * light;
  const dp = c.dp;
  const mod = {
    brochet: (dp <= -1 ? .12 : 0) + (dp >= 3 ? -.12 : 0) + (c.wind >= 8 && c.wind <= 28 ? .06 : 0),
    sandre: (dp <= -1 ? .08 : 0) + (dp >= 3 ? -.08 : 0) + (cloudy ? .06 : 0) + (rainy && c.rain < 4 ? .06 : 0) + (waterType !== "etang" ? .03 : 0),
    perche: (Math.abs(dp) < 1.2 ? .08 : 0) + (dp <= -3 ? -.06 : 0) + (c.wind >= 5 && c.wind <= 22 ? .04 : 0),
    bass: (dp >= 3 ? -.15 : 0) + (Math.abs(dp) < 1.2 ? .05 : 0) + (!cloudy && c.air >= 15 ? .05 : 0) + (waterType === "etang" ? .04 : 0) + (waterType === "riviere" ? -.04 : 0),
    silure: (dp <= -1 ? .1 : 0) + (dp >= 3 ? -.08 : 0) + (rainy && c.rain < 4 ? .05 : 0) + (cloudy ? .03 : 0) + (waterType === "riviere" ? .06 : waterType === "canal" ? .02 : -.03),
    chevesne: (Math.abs(dp) < 1.2 ? .06 : 0) + (dp >= 3 ? -.06 : 0) + (!cloudy && c.water >= 14 && c.phase === "jour" ? .05 : 0) + (waterType === "riviere" ? .06 : waterType === "etang" ? -.04 : 0),
    carpe: (dp <= -1 && c.water >= 12 ? .08 : 0) + (dp >= 3 ? -.1 : 0) + (c.wind >= 6 && c.wind <= 25 && c.air >= 12 ? .06 : 0) + (waterType === "etang" ? .03 : 0),
  }[sp.id];
  s += mod;
  if (c.wind > 40) s -= .15;
  if (c.rain >= 4) s -= .08;
  return Math.max(0, Math.min(1, s));
}

export function weatherUrl(lat, lon) {
  return "https://api.open-meteo.com/v1/forecast?latitude=" + Number(lat).toFixed(3) + "&longitude=" + Number(lon).toFixed(3) +
    "&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&daily=sunrise,sunset&past_days=5&forecast_days=2&timezone=auto";
}

// Meilleure heure de la journée (5h à 22h, heure locale) pour chaque espèce
export function scoreDay(d, ids, waterType, nowMs = Date.now()) {
  const H = d.hourly, off = d.utc_offset_seconds || 0;
  const localNow = new Date(nowMs + off * 1000);
  const today = localNow.toISOString().slice(0, 10);
  const month = localNow.getUTCMonth() + 1;
  const i0 = H.time.indexOf(today + "T00:00");
  if (i0 < 0) return [];
  const past = H.temperature_2m.slice(Math.max(0, i0 - 120), i0 + 1).filter((v) => v != null);
  const water = Math.max(2, Math.min(30, 0.85 * past.reduce((a, b) => a + b, 0) / past.length + 1.5));
  const k = d.daily.time.indexOf(today);
  const f = (s) => { const [hh, mm] = s.slice(11, 16).split(":").map(Number); return hh + mm / 60; };
  const rise = k >= 0 ? f(d.daily.sunrise[k]) : 7.5, set = k >= 0 ? f(d.daily.sunset[k]) : 18.5;
  const out = [];
  for (const sp of SPECIES) {
    if (ids && ids.length && !ids.includes(sp.id)) continue;
    if (CLOSED[sp.id]?.(month)) continue;
    let best = { score: 0, hour: null };
    for (let h = 5; h <= 22; h++) {
      const i = i0 + h;
      if (H.time[i] == null) break;
      const c = {
        phase: phase(h + .5, rise, set), water, air: H.temperature_2m[i],
        dp: (H.surface_pressure[i] ?? 0) - (H.surface_pressure[i - 3] ?? H.surface_pressure[i]),
        wind: H.wind_speed_10m[i], cloud: H.cloud_cover[i], rain: H.precipitation[i] || 0,
      };
      const s = scoreHour(sp, c, waterType);
      if (s > best.score) best = { score: s, hour: h };
    }
    out.push({ id: sp.id, name: sp.name, score: Math.round(best.score * 100), hour: best.hour });
  }
  return out.sort((a, b) => b.score - a.score);
}

// Dates clés de la réglementation (2e catégorie), date au format AAAA-MM-JJ
function lastWeekday(y, m, wd) { const d = new Date(Date.UTC(y, m + 1, 0)); while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() - 1); return d; }
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export function openingReminder(today) {
  const y = Number(today.slice(0, 4));
  const open = iso(lastWeekday(y, 3, 6)), close = iso(lastWeekday(y, 0, 0));
  if (today === addDays(open, -7)) return { title: "🗓️ Ouverture du brochet dans 7 jours", body: "Samedi " + Number(open.slice(8)) + " avril : prépare tes leurres et vérifie l'arrêté de ton département." };
  if (today === addDays(open, -1)) return { title: "🎣 Ouverture du brochet demain !", body: "Brochet, et souvent sandre et black-bass, ouverts en 2e catégorie. Taille mini du brochet : 60 cm." };
  if (today === addDays(close, -1)) return { title: "⛔ Fermeture du brochet demain", body: "Dernier jour pour le brochet aujourd'hui en 2e catégorie. Réouverture le dernier samedi d'avril." };
  return null;
}
