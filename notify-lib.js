// Rivio : bibliothèque d'envoi des notifications (utilisée par la fonction Supabase « notify »)
import { scoreDay, weatherUrl, openingReminder } from "./score-lib.js";
// ---- Web Push (RFC 8291 aes128gcm + VAPID RFC 8292), WebCrypto uniquement ----
const te = new TextEncoder();
export const b64u = {
  enc(buf) {
    let s = ""; const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(str) {
    const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(s); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};
export function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}
export async function encryptPayload(p256dhB64, authB64, payloadText) {
  const uaPub = b64u.dec(p256dhB64), authSecret = b64u.dec(authB64);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = concat(te.encode(payloadText), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plain));
  const header = new Uint8Array(21);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPub.length;
  return concat(header, asPub, cipher);
}
export async function vapidHeader(endpoint, jwk, pubB64, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u.enc(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", { ...jwk, key_ops: ["sign"], ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(head + "." + body));
  return "vapid t=" + head + "." + body + "." + b64u.enc(sig) + ", k=" + pubB64;
}
export async function sendPush(sub, payloadText, vapid, urgency = "normal") {
  const body = await encryptPayload(sub.p256dh, sub.auth, payloadText);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Urgency": urgency,
      "Authorization": await vapidHeader(sub.endpoint, vapid.jwk, vapid.pub, vapid.subject),
    },
    body,
  });
}

let SB_URL, SB_KEY;
async function db(path, init = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(path + " -> " + r.status + " " + (await r.text()));
  return r.status === 204 ? null : r.json();
}
const num = (x) => String(x).replace(".", ",");

const RATING = { 1: "c'était désert", 2: "journée moyenne", 3: "belle journée", 4: "journée de fou" };
const cut = (t, n) => (t || "").length > n ? t.slice(0, n - 1) + "…" : (t || "");

async function activeMembers(g, exclude) {
  return db("memberships?group_id=eq." + g + "&status=eq.active" + (exclude ? "&user_id=neq." + exclude : "") + "&select=user_id");
}
async function moderators(g, exclude) {
  const [mods, admins] = await Promise.all([
    db("memberships?group_id=eq." + g + "&status=eq.active&role=in.(owner,moderator)&select=user_id"),
    db("profiles?or=(is_admin.eq.true,is_controller.eq.true)&select=id"),
  ]);
  const ids = new Set([...mods.map((m) => m.user_id), ...admins.map((a) => a.id)]);
  if (exclude) ids.delete(exclude);
  return [...ids].map((user_id) => ({ user_id }));
}

export async function handle(req, cfg) {
  SB_URL = cfg.url; SB_KEY = cfg.key;
  const HOOK_SECRET = cfg.secret, VAPID = cfg.vapid;
  if (req.headers.get("x-hook-secret") !== HOOK_SECRET) return new Response("forbidden", { status: 403 });
  try {
    const ev = await req.json();
    const t = ev.table;
    if (t === "morning") return Response.json(await morning(ev, VAPID));
    if (t === "outing_reminders") return Response.json(await outingReminders(VAPID));
    if (t === "bait_reminders") return Response.json(await baitReminders(VAPID));
    if (t === "flood_watch") return Response.json(await floodWatch(VAPID));
    if (t === "checkins") return Response.json(await checkinNotify(Number(ev.id), VAPID));
    if (t === "wake_alarms") return Response.json(await wakeAlarms(VAPID));
    if (t === "storm_watch") return Response.json(await stormWatch(VAPID));
    if (t === "photo_month") return Response.json(await photoMonth(VAPID));
    let rec, group_id, author, recipients, msg;
    if (t === "memberships") {
      group_id = Number(ev.group_id); author = String(ev.user_id).replace(/[^0-9a-f-]/gi, "");
      rec = { user_id: author };
    } else {
      const cols = {
        posts: "id,group_id,user_id,status,species,length_cm,weight_kg,caption,photo_path,photo_paths",
        spots: "id,group_id,user_id,name",
        polls: "id,group_id,user_id,question,place",
        memos: "id,group_id,user_id,title",
        sessions: "id,group_id,user_id,species,caught,length_cm,lure,color,rating",
        messages: "id,group_id,user_id,body,photo_path,audio_secs",
        comments: "id,post_id,user_id,body",
        challenges: "id,group_id,user_id,title,species,min_length",
        outings: "id,group_id,user_id,title,place,start_at",
        reports: "id,group_id,user_id,kind,reason,excerpt",
        competitions: "id,group_id,user_id,title,start_at,end_at",
      }[t];
      if (!cols) return new Response("bad table", { status: 400 });
      [rec] = await db(t + "?id=eq." + Number(ev.id) + "&select=" + cols);
      if (!rec) return Response.json({ sent: 0, reason: "introuvable" });
      group_id = rec.group_id; author = rec.user_id;
      if (t === "comments") {
        const [p] = await db("posts?id=eq." + Number(rec.post_id) + "&select=group_id,user_id,species");
        if (!p) return Response.json({ sent: 0, reason: "introuvable" });
        group_id = p.group_id; rec.post = p;
      }
    }
    let extra = null;
    const [groups, users] = await Promise.all([
      db("groups?id=eq." + group_id + "&select=name"),
      db("profiles?id=eq." + author + "&select=username"),
    ]);
    const group = groups[0]?.name || "ton groupe", who = "@" + (users[0]?.username || "quelqu'un");

    if (t === "memberships") {
      if (ev.event === "request") {
        recipients = await moderators(group_id, author);
        msg = { title: "🙋 Demande d'adhésion · " + group, body: who + " veut rejoindre le groupe", url: "./#modo", tag: "req-" + group_id };
      } else {
        recipients = [{ user_id: author }];
        msg = { title: "✅ Bienvenue dans " + group, body: "Ta demande a été acceptée, bonne pêche !", url: "./#fil", tag: "ok-" + group_id };
      }
    } else if (t === "posts") {
      const n = (rec.photo_paths && rec.photo_paths.length) || (rec.photo_path ? 1 : 0);
      const parts = [rec.species, rec.length_cm ? num(rec.length_cm) + " cm" : "", rec.weight_kg ? num(rec.weight_kg) + " kg" : ""].filter(Boolean);
      let text = parts.join(" · ") || cut(rec.caption, 90) || (n ? "nouvelle photo" : "nouveau post");
      if (n > 1) text += " · " + n + " photos";
      if (ev.event === "pending") {
        recipients = await moderators(group_id, author);
        msg = { title: "🕓 Prise à valider · " + group, body: who + " : " + text, url: "./#modo", tag: "pend-" + rec.id };
      } else {
        recipients = await activeMembers(group_id, author);
        msg = { title: "🎣 Nouvelle prise · " + group, body: who + " : " + text, url: "./#fil", tag: "post-" + rec.id };
      }
    } else if (t === "reports") {
      recipients = await moderators(group_id, author);
      const what = { post: "une prise", comment: "un commentaire", message: "un message" }[rec.kind] || "un contenu";
      msg = { title: "⚑ Signalement · " + group, body: who + " signale " + what + " : " + cut(rec.reason, 80) + (rec.excerpt ? " (« " + cut(rec.excerpt, 50) + " »)" : ""), url: "./#modo", tag: "rep-" + rec.id };
    } else {
      recipients = await activeMembers(group_id, author);
      if (t === "spots") msg = { title: "📍 Nouveau spot · " + group, body: who + " a ajouté « " + rec.name + " »", url: "./#carte", tag: "spot-" + rec.id };
      else if (t === "polls") msg = { title: "📊 Sondage · " + group, body: who + " : " + cut(rec.question, 110) + (rec.place ? " (" + rec.place + ")" : ""), url: "./#groupe", tag: "poll-" + rec.id };
      else if (t === "memos") msg = { title: "📌 Nouveau mémo · " + group, body: who + " : " + cut(rec.title, 100), url: "./#groupe", tag: "memo-" + rec.id };
      else if (t === "sessions") {
        const fish = rec.caught === false ? (rec.species ? rec.species + " ciblé, capot" : "capot") : [rec.species, rec.length_cm ? num(rec.length_cm) + " cm" : ""].filter(Boolean).join(" ");
        const combo = [rec.lure, rec.color].filter(Boolean).join(" ");
        msg = { title: "🧾 Bilan de session · " + group, body: who + " : " + [fish, combo, RATING[rec.rating]].filter(Boolean).join(" · "), url: "./#groupe", tag: "sess-" + rec.id };
      } else if (t === "competitions") {
        msg = { title: "🏆 Compétition · " + group, body: who + " lance « " + cut(rec.title, 60) + " » du " + whenFr(rec.start_at) + " au " + whenFr(rec.end_at), url: "./#groupe", tag: "comp-" + rec.id };
      } else if (t === "outings") {
        msg = { title: "📅 Sortie prévue · " + group, body: who + " : " + cut(rec.title, 70) + " · " + whenFr(rec.start_at) + (rec.place ? " · " + cut(rec.place, 40) : ""), url: "./#groupe", tag: "out-" + rec.id };
      } else if (t === "challenges") {
        msg = { title: "🏅 Nouveau défi · " + group, body: who + " lance : " + cut(rec.title, 110), url: "./#groupe", tag: "chal-" + rec.id };
      } else if (t === "comments") {
        const prev = await db("comments?post_id=eq." + Number(rec.post_id) + "&select=user_id");
        const ids = new Set([rec.post.user_id, ...prev.map((c) => c.user_id)]);
        ids.delete(author);
        const active = new Set((await activeMembers(group_id)).map((m) => m.user_id));
        recipients = [...ids].filter((id) => active.has(id)).map((user_id) => ({ user_id }));
        msg = { title: "💬 Commentaire · " + group, body: who + " : " + cut(rec.body, 130), url: "./#fil", tag: "com-" + rec.post_id };
      } else {
        const secs = Number(rec.audio_secs) || 0;
        const text = secs ? "🎤 Message vocal (" + Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0") + ")"
          : rec.photo_path ? "📷 Photo" + (rec.body ? " · " + cut(rec.body, 110) : "") : cut(rec.body, 140);
        msg = { title: "💬 " + group, body: who + " : " + text, url: "./#chat", tag: "chat-" + group_id };
        const names = [...new Set((String(rec.body || "").match(/@([A-Za-z0-9_]{3,20})/g) || []).map((x) => x.slice(1).toLowerCase()))].slice(0, 10);
        if (names.length) {
          const cand = await db("profiles?select=id,username&or=(" + names.map((n) => "username.ilike." + n.replace(/[,()*%]/g, "")).join(",") + ")");
          const found = cand.filter((p) => names.includes(String(p.username).toLowerCase()));
          const hit = new Set(found.map((p) => p.id).filter((id) => id !== author && recipients.some((m) => m.user_id === id)));
          if (hit.size) {
            recipients = recipients.filter((m) => !hit.has(m.user_id));
            extra = { recipients: [...hit].map((user_id) => ({ user_id })), msg: { title: "📣 " + who + " t'a mentionné · " + group, body: text, url: "./#chat", tag: "ment-" + rec.id } };
          }
        }
      }
    }
    const batches = [{ recipients, msg }];
    if (extra) batches.push(extra);
    const out = [];
    for (const b of batches) {
      if (!b.recipients.length) continue;
      await logNotif(b.recipients.map((m) => m.user_id), b.msg);
      const subs = await db("push_subs?user_id=in.(" + b.recipients.map((m) => m.user_id).join(",") + ")&select=endpoint,p256dh,auth");
      const payload = JSON.stringify(b.msg);
      const results = await Promise.allSettled(subs.map(async (s) => {
        const r = await sendPush(s, payload, VAPID);
        if (r.status === 404 || r.status === 410) {
          await db("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
        }
        return r.status;
      }));
      out.push(...results.map((x) => x.status === "fulfilled" ? x.value : String(x.reason)));
    }
    if (!out.length) return Response.json({ sent: 0, reason: "aucun destinataire ou abonné" });
    return Response.json({ sent: out.length, results: out });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// ---- Centre de notifications : on garde une trace de chaque notification envoyée ----
async function logNotif(ids, msg) {
  if (!ids.length || msg.test || /^chat-/.test(msg.tag || "")) return; // les messages du chat restent dans le chat
  const rows = [...new Set(ids)].map((user_id) => ({ user_id, title: cut(msg.title, 200), body: msg.body ? cut(msg.body, 500) : null, url: msg.url ? String(msg.url).slice(0, 60) : null, tag: msg.tag ? String(msg.tag).slice(0, 80) : null }));
  try { await db("notifications", { method: "POST", body: JSON.stringify(rows), headers: { Prefer: "return=minimal" } }); } catch (_) { /* le journal ne doit jamais bloquer l'envoi */ }
}
// ---- Alerte du matin : bonnes conditions + rappels d'ouverture ----
async function pushTo(user_id, msg, vapid) {
  await logNotif([user_id], msg);
  const subs = await db("push_subs?user_id=eq." + user_id + "&select=endpoint,p256dh,auth");
  const payload = JSON.stringify(msg);
  let ok = 0;
  await Promise.allSettled(subs.map(async (s) => {
    const r = await sendPush(s, payload, vapid, msg.alarm ? "high" : "normal");
    if (r.status === 404 || r.status === 410) await db("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
    else if (r.ok) ok++;
  }));
  return ok;
}
async function morning(ev, vapid) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const test = ev.test === true && /^[0-9a-f-]{36}$/i.test(String(ev.user_id || ""));
  let q = "alert_prefs?enabled=eq.true&select=user_id,lat,lon,place,species,threshold,water,opening,flood,last_sent";
  if (test) q = "alert_prefs?user_id=eq." + ev.user_id + "&select=user_id,lat,lon,place,species,threshold,water,opening,flood,last_sent";
  const prefs = await db(q);
  const reminder = openingReminder(today);
  const cache = new Map();
  const report = [];
  for (const p of prefs) {
    if (!test && p.last_sent === today) continue;
    const msgs = [];
    if (p.lat != null && p.lon != null) {
      const key = Number(p.lat).toFixed(2) + "," + Number(p.lon).toFixed(2);
      try {
        if (!cache.has(key)) cache.set(key, fetch(weatherUrl(p.lat, p.lon)).then((r) => r.ok ? r.json() : null));
        const d = await cache.get(key);
        if (d) {
          const all = scoreDay(d, p.species || [], p.water || "etang");
          const good = (test ? all : all.filter((x) => x.score >= (p.threshold || 70))).slice(0, 3);
          if (good.length) msgs.push({
            title: (test ? "🧪 Test · " : "") + "🎣 Bonnes conditions aujourd'hui" + (p.place ? " · " + p.place : ""),
            body: good.map((x) => x.name + " " + x.score + " % vers " + x.hour + "h").join(" · "),
            url: "./#conseils", tag: "morning",
          });
        }
      } catch (_) { /* météo indisponible : on passe */ }
    }
    if (p.opening !== false && reminder) msgs.push({ ...reminder, url: "./#conseils", tag: "regl-" + today });
    if (p.flood !== false && p.lat != null && p.lon != null) {
      const fl = await floodCheck(p.lat, p.lon, cache);
      if (fl) msgs.push({ title: "🌊 Montée des eaux prévue" + (p.place ? " · " + p.place : ""), body: "Débit ×" + num(fl.ratio.toFixed(1)) + " par rapport à la normale " + fl.when + ". Prudence au bord de l'eau, eau trouble et courant fort.", url: "./#conseils", tag: "flood-" + today });
    }
    if (test && !msgs.length) msgs.push({ title: "🧪 Test · Alerte du matin", body: "Les alertes fonctionnent. Ajoute ta position pour recevoir les conditions.", url: "./#profil", tag: "morning" });
    let sent = 0;
    for (const m of msgs) sent += await pushTo(p.user_id, m, vapid);
    if (!test && msgs.length) await db("alert_prefs?user_id=eq." + p.user_id, { method: "PATCH", body: JSON.stringify({ last_sent: today }), headers: { Prefer: "return=minimal" } });
    report.push({ msgs: msgs.length, sent });
  }
  // rappel de la carte de pêche : 30 jours, 7 jours, la veille et le jour même
  if (!test) {
    const dates = [0, 1, 7, 30].map((n) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + n * 864e5)));
    const perm = await db("profiles?permit_end=in.(" + dates.join(",") + ")&select=id,permit_end");
    for (const u of perm) {
      const n = dates.indexOf(u.permit_end), d = [0, 1, 7, 30][n];
      await pushTo(u.id, { title: "🎫 Carte de pêche", body: d === 0 ? "Ta carte de pêche expire aujourd'hui : pense à la renouveler avant ta prochaine sortie." : "Ta carte de pêche expire " + (d === 1 ? "demain" : "dans " + d + " jours") + ". Renouvelle-la sur cartedepeche.fr.", url: "./#profil", tag: "permit" }, vapid);
    }
    report.push({ permits: perm.length });
  }
  return { day: today, users: prefs.length, report };
}
// débit de la rivière la plus proche : alerte si forte montée prévue sous 3 jours
async function floodCheck(lat, lon, cache) {
  const key = "fl" + Number(lat).toFixed(2) + "," + Number(lon).toFixed(2);
  if (!cache.has(key)) cache.set(key, fetch("https://flood-api.open-meteo.com/v1/flood?latitude=" + Number(lat).toFixed(3) + "&longitude=" + Number(lon).toFixed(3) + "&daily=river_discharge&past_days=60&forecast_days=4").then((r) => r.ok ? r.json() : null).catch(() => null));
  const d = await cache.get(key);
  if (!d?.daily?.river_discharge) return null;
  const t = d.daily.time, q = d.daily.river_discharge;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const i = t.indexOf(today); if (i < 0) return null;
  const past = q.slice(0, i).filter((v) => v != null).sort((a, b) => a - b);
  if (past.length < 10) return null;
  const med = past[Math.floor(past.length / 2)];
  if (!(med > 1)) return null;
  let best = null;
  for (let k = i + 1; k <= Math.min(q.length - 1, i + 3); k++) {
    if (q[k] == null) continue;
    const ratio = q[k] / med, jump = q[i] ? q[k] / q[i] : 1;
    if (ratio >= 2 && jump >= 1.5 && (!best || ratio > best.ratio)) best = { ratio, k };
  }
  if (!best) return null;
  const n = best.k - i;
  return { ratio: best.ratio, when: n === 1 ? "demain" : "d'ici " + n + " jours" };
}
// ---- Surveillance des stations Hub'Eau : montée rapide mesurée (crue, lâcher de barrage) ----
const HUB = "https://hubeau.eaufrance.fr/api/";
function kmBetween(a, b, c, d) { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); }
async function hubGet(path) { const r = await fetch(HUB + path); if (!r.ok) throw new Error("hubeau " + r.status); return r.json(); }
export function riseOf(rows) {
  // rows : [{t, v, g}] triés par date ; renvoie la montée sur 6 h (m) et le rapport de débit sur 24 h
  const ser = (g) => rows.filter((x) => x.g === g);
  const at = (r, h) => { if (!r.length) return null; const last = r[r.length - 1], target = last.t - h * 36e5; let best = null; for (const x of r) if (Math.abs(x.t - target) <= 2 * 36e5 && (!best || Math.abs(x.t - target) < Math.abs(best.t - target))) best = x; return best ? best.v : null; };
  const H = ser("H"), Q = ser("Q");
  const h6 = H.length ? at(H, 6) : null, q24 = Q.length ? at(Q, 24) : null;
  return {
    dh6: H.length && h6 != null ? (H[H.length - 1].v - h6) / 1000 : null,
    rq24: Q.length && q24 ? Q[Q.length - 1].v / q24 : null,
    last: Math.max(H.length ? H[H.length - 1].t : 0, Q.length ? Q[Q.length - 1].t : 0),
  };
}
async function stationRise(lat, lon) {
  const st = await hubGet("v2/hydrometrie/referentiel/stations?latitude=" + Number(lat).toFixed(4) + "&longitude=" + Number(lon).toFixed(4) + "&distance=15&en_service=true&format=json&size=60");
  const near = (st.data || []).map((s) => ({ s, d: kmBetween(lat, lon, Number(s.latitude_station ?? s.latitude), Number(s.longitude_station ?? s.longitude)) })).filter((x) => x.d <= 15).sort((a, b) => a.d - b.d).slice(0, 3);
  const since = new Date(Date.now() - 26 * 36e5).toISOString().slice(0, 19);
  for (const { s } of near) {
    try {
      const o = await hubGet("v2/hydrometrie/observations_tr?code_entite=" + s.code_station + "&date_debut_obs=" + since + "&size=3000&fields=date_obs,resultat_obs,grandeur_hydro&format=json");
      const rows = (o.data || []).filter((x) => x.resultat_obs != null).map((x) => ({ t: Date.parse(x.date_obs), v: Number(x.resultat_obs), g: x.grandeur_hydro })).sort((a, b) => a.t - b.t);
      if (!rows.length) continue;
      const r = riseOf(rows);
      if (Date.now() - r.last > 6 * 36e5) continue;
      return { ...r, station: s.libelle_station || s.code_station };
    } catch (_) { /* station suivante */ }
  }
  return null;
}
async function floodWatch(vapid) {
  const prefs = await db("alert_prefs?flood=eq.true&lat=not.is.null&select=user_id,lat,lon,place,flood_sent_at");
  const cache = new Map(); let sent = 0, checked = 0;
  for (const p of prefs) {
    if (p.flood_sent_at && Date.now() - Date.parse(p.flood_sent_at) < 12 * 36e5) continue;
    const key = Number(p.lat).toFixed(2) + "," + Number(p.lon).toFixed(2);
    if (!cache.has(key)) cache.set(key, stationRise(p.lat, p.lon).catch(() => null));
    const r = await cache.get(key); checked++;
    if (!r) continue;
    const fast = (r.dh6 != null && r.dh6 >= 0.3) || (r.rq24 != null && r.rq24 >= 1.8);
    if (!fast) continue;
    const what = [r.dh6 != null && r.dh6 > 0 ? "+" + Math.round(r.dh6 * 100) + " cm en 6 h" : null, r.rq24 ? "débit ×" + num(r.rq24.toFixed(1)) + " en 24 h" : null].filter(Boolean).join(", ");
    sent += await pushTo(p.user_id, { title: "🌊 L'eau monte vite" + (p.place ? " · " + p.place : ""), body: "Station « " + r.station + " » : " + what + ". Crue ou lâcher de barrage possible, prudence au bord de l'eau.", url: "./#conseils", tag: "floodlive" }, vapid);
    await db("alert_prefs?user_id=eq." + p.user_id, { method: "PATCH", body: JSON.stringify({ flood_sent_at: new Date().toISOString() }), headers: { Prefer: "return=minimal" } });
  }
  return { prefs: prefs.length, checked, sent };
}

// ---- « Je pars pêcher » et potes à proximité ----
async function checkinNotify(id, vapid) {
  const [c] = await db("checkins?id=eq." + id + "&select=id,group_id,user_id,kind,announce,spot_id,place,lat,lon,note,started_at,ends_at");
  if (!c) return { sent: 0, reason: "introuvable" };
  const [author] = await db("profiles?id=eq." + c.user_id + "&select=username,nearby_share");
  const who = "@" + (author?.username || "quelqu'un");
  if (!c.announce && author?.nearby_share === false) return { sent: 0, reason: "partage désactivé" };
  // destinataires : membres actifs du groupe (ou de tous les groupes de l'auteur pour un signalement sans groupe)
  let gids = c.group_id ? [c.group_id] : (await db("memberships?user_id=eq." + c.user_id + "&status=eq.active&select=group_id")).map((m) => m.group_id);
  if (!gids.length) return { sent: 0, reason: "aucun groupe" };
  const mem = await db("memberships?group_id=in.(" + gids.join(",") + ")&status=eq.active&user_id=neq." + c.user_id + "&select=user_id,group_id");
  const ids = [...new Set(mem.map((m) => m.user_id))];
  if (!ids.length) return { sent: 0, reason: "aucun membre" };
  // position des destinataires : position partagée récente, sinon dernière sortie signalée, sinon lieu de l'alerte du matin
  const since = new Date(Date.now() - 2 * 36e5).toISOString();
  const [profs, lives, prefs, recent] = await Promise.all([
    db("profiles?id=in.(" + ids.join(",") + ")&select=id,nearby_km"),
    db("live_positions?user_id=in.(" + ids.join(",") + ")&updated_at=gte." + since + "&select=user_id,lat,lon"),
    db("alert_prefs?user_id=in.(" + ids.join(",") + ")&lat=not.is.null&select=user_id,lat,lon"),
    db("checkins?user_id=in.(" + ids.join(",") + ")&started_at=gte." + new Date(Date.now() - 12 * 36e5).toISOString() + "&select=user_id,lat,lon,started_at&order=started_at.desc"),
  ]);
  const posOf = (u) => lives.find((x) => x.user_id === u) || recent.find((x) => x.user_id === u) || prefs.find((x) => x.user_id === u) || null;
  // pas de doublon « près de toi » : une seule fois par auteur toutes les 6 h
  const prev = await db("checkins?user_id=eq." + c.user_id + "&id=neq." + c.id + "&started_at=gte." + new Date(Date.now() - 6 * 36e5).toISOString() + "&select=id&limit=1");
  const groups = c.group_id ? await db("groups?id=eq." + c.group_id + "&select=name") : [];
  const spot = c.spot_id ? (await db("spots?id=eq." + c.spot_id + "&select=name"))[0]?.name : null;
  const where = spot || c.place || null;
  const until = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(c.ends_at)).replace(":", "h");
  let sent = 0, near = 0;
  for (const u of ids) {
    const prof = profs.find((p) => p.id === u), km = prof ? prof.nearby_km : 15;
    const pos = posOf(u);
    const d = pos ? kmBetween(Number(c.lat), Number(c.lon), Number(pos.lat), Number(pos.lon)) : null;
    const isNear = km > 0 && d != null && d <= km;
    let msg = null;
    if (c.announce) {
      msg = {
        title: (isNear ? "📍 " + who + " pêche à " + num(d < 1 ? "moins de 1" : Math.round(d)) + " km de toi" : "🎣 " + who + " est au bord de l'eau") + (groups[0] ? " · " + groups[0].name : ""),
        body: [where, "jusqu'à " + until, c.note].filter(Boolean).join(" · ") + ". Rejoins-le !",
        url: "./#fil", tag: "chk-" + c.user_id,
      };
    } else if (isNear && !prev.length) {
      msg = { title: "📍 " + who + " pêche à " + num(d < 1 ? "moins de 1" : Math.round(d)) + " km de toi", body: (c.kind === "live" ? "Il partage sa position avec le groupe." : "Il vient de lancer une trace de sortie.") + " Ouvre la carte pour le retrouver.", url: "./#carte", tag: "chk-" + c.user_id };
    }
    if (!msg) continue;
    if (isNear) near++;
    sent += await pushTo(u, msg, vapid);
  }
  return { members: ids.length, near, sent };
}

// ---- Réveil pêche ----
async function wakeAlarms(vapid) {
  const rows = await db("wake_alarms?sent_at=is.null&fire_at=lte." + new Date().toISOString() + "&select=id,user_id,title,body,fire_at,url&limit=200");
  let sent = 0;
  for (const r of rows) {
    // on marque d'abord, pour ne jamais sonner deux fois ; un réveil vieux de plus de 30 min n'est plus envoyé
    await db("wake_alarms?id=eq." + r.id, { method: "PATCH", body: JSON.stringify({ sent_at: new Date().toISOString() }), headers: { Prefer: "return=minimal" } });
    if (Date.now() - Date.parse(r.fire_at) > 30 * 6e4) continue;
    sent += await pushTo(r.user_id, { title: r.title, body: r.body || "", url: r.url || "./#conseils", tag: "wake-" + r.id, alarm: true }, vapid);
  }
  return { due: rows.length, sent };
}

// ---- Alerte orage pendant une sortie ----
async function stormAt(lat, lon) {
  const u = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&minutely_15=weather_code,wind_gusts_10m&forecast_minutely_15=8&timezone=GMT";
  const r = await fetch(u); if (!r.ok) throw new Error("open-meteo " + r.status);
  const j = await r.json(), m = j.minutely_15 || {}, times = m.time || [];
  for (let i = 0; i < times.length; i++) {
    const code = m.weather_code?.[i], g = m.wind_gusts_10m?.[i];
    const thunder = code === 95 || code === 96 || code === 99, wind = g != null && g >= 65;
    if (thunder || wind) return { thunder, wind, gust: g, at: times[i], hail: code === 96 || code === 99 };
  }
  return null;
}
async function stormWatch(vapid) {
  const now = new Date(), old = new Date(Date.now() - 3 * 36e5).toISOString();
  const [chk, carp] = await Promise.all([
    db("checkins?ended_at=is.null&ends_at=gt." + now.toISOString() + "&or=(storm_sent_at.is.null,storm_sent_at.lt." + old + ")&select=id,user_id,lat,lon,place,spot_id"),
    db("carp_sessions?ended_at=is.null&spot_id=not.is.null&started_at=gt." + new Date(Date.now() - 72 * 36e5).toISOString() + "&or=(storm_sent_at.is.null,storm_sent_at.lt." + old + ")&select=id,user_id,spot_id,spots(name,lat,lon)"),
  ]);
  const todo = [
    ...chk.map((c) => ({ table: "checkins", id: c.id, user_id: c.user_id, lat: Number(c.lat), lon: Number(c.lon), place: c.place })),
    ...carp.filter((c) => c.spots?.lat != null).map((c) => ({ table: "carp_sessions", id: c.id, user_id: c.user_id, lat: Number(c.spots.lat), lon: Number(c.spots.lon), place: c.spots.name })),
  ];
  const cache = new Map(), warned = new Set(); let sent = 0;
  for (const x of todo) {
    const key = x.lat.toFixed(1) + "," + x.lon.toFixed(1);
    if (!cache.has(key)) cache.set(key, stormAt(x.lat.toFixed(3), x.lon.toFixed(3)).catch(() => null));
    const s = await cache.get(key);
    if (!s) continue;
    await db(x.table + "?id=eq." + x.id, { method: "PATCH", body: JSON.stringify({ storm_sent_at: now.toISOString() }), headers: { Prefer: "return=minimal" } });
    if (warned.has(x.user_id)) continue;   // une seule alerte par pêcheur, même s'il a une trace et une session carpe
    warned.add(x.user_id);
    const mins = Math.max(0, Math.round((Date.parse(s.at + ":00Z") - Date.now()) / 6e4));
    const when = mins <= 15 ? "dans le quart d'heure" : "dans environ " + (mins >= 60 ? Math.round(mins / 60) + " h" : Math.round(mins / 15) * 15 + " min");
    const what = s.thunder ? (s.hail ? "Orage avec grêle" : "Orage") + (s.wind ? " et rafales à " + Math.round(s.gust) + " km/h" : "") : "Rafales à " + Math.round(s.gust) + " km/h";
    sent += await pushTo(x.user_id, {
      title: (s.thunder ? "⛈️ " : "💨 ") + what + " " + when + (x.place ? " · " + cut(x.place, 30) : ""),
      body: s.thunder ? "Range les cannes en carbone, éloigne-toi de l'eau et des arbres isolés, abrite-toi dans un véhicule ou un bâtiment." : "Attention aux branches, au float-tube et au bateau : rapproche-toi de la berge et mets le matériel à l'abri.",
      url: "./#conseils", tag: "storm", alarm: true,
    }, vapid);
  }
  return { checked: todo.length, points: cache.size, sent };
}

// ---- Photo du mois : annonce du gagnant le 1er ----
async function photoMonth(vapid) {
  const d = new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date()) + "T12:00:00Z");
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  const month = d.toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(d);
  const votes = await db("photo_votes?month=eq." + month + "&select=group_id,post_id,created_at");
  const byGroup = new Map();
  for (const v of votes) { const g = byGroup.get(v.group_id) || new Map(); g.set(v.post_id, (g.get(v.post_id) || 0) + 1); byGroup.set(v.group_id, g); }
  let sent = 0, groups = 0;
  for (const [gid, counts] of byGroup) {
    const best = Math.max(...counts.values());
    const ids = [...counts].filter(([, n]) => n === best).map(([id]) => id);
    const posts = await db("posts?id=in.(" + ids.join(",") + ")&select=id,user_id,species,length_cm,created_at,profiles(username)&order=created_at.asc");
    if (!posts.length) continue;
    const w = posts[0]; groups++;
    const mem = await activeMembers(gid);
    const what = [w.species, w.length_cm ? num(w.length_cm) + " cm" : null].filter(Boolean).join(" de ");
    for (const m of mem) {
      const mine = m.user_id === w.user_id;
      sent += await pushTo(m.user_id, {
        title: mine ? "🏆 Ta photo est la photo du mois !" : "🏆 Photo du mois de " + label,
        body: (mine ? "Le groupe a voté pour ta photo" : "@" + (w.profiles?.username || "?") + " l'emporte") + (what ? " (" + what + ")" : "") + " avec " + best + " vote" + (best > 1 ? "s" : "") + ". Les votes de ce mois sont ouverts !",
        url: "./#groupe", tag: "photo-mois-" + gid,
      }, vapid);
    }
  }
  return { month, groups, sent };
}

// ---- Rappel d'amorçage des sessions carpe en cours ----
async function baitReminders(vapid) {
  const now = new Date().toISOString();
  const rows = await db("carp_sessions?ended_at=is.null&next_bait_at=lte." + now + "&select=id,user_id,bait_every_min,started_at");
  let sent = 0;
  for (const r of rows) {
    if (Date.now() - new Date(r.started_at).getTime() > 72 * 36e5 || !r.bait_every_min) {
      await db("carp_sessions?id=eq." + r.id, { method: "PATCH", body: JSON.stringify({ next_bait_at: null }), headers: { Prefer: "return=minimal" } });
      continue;
    }
    sent += await pushTo(r.user_id, { title: "🥣 C'est l'heure de réamorcer", body: "Rappel toutes les " + r.bait_every_min + " min. Note l'amorçage dans l'appli pour relancer le compte à rebours.", url: "./#fil", tag: "bait-" + r.id }, vapid);
    await db("carp_sessions?id=eq." + r.id, { method: "PATCH", body: JSON.stringify({ next_bait_at: new Date(Date.now() + r.bait_every_min * 6e4).toISOString() }), headers: { Prefer: "return=minimal" } });
  }
  return { due: rows.length, sent };
}

// ---- Sorties planifiées : rappel la veille ----
function whenFr(iso) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short" }).format(d);
  const h = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d).replace(":", "h");
  return day + " " + h;
}
async function outingReminders(vapid) {
  const parisDay = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(d);
  const tomorrow = parisDay(new Date(Date.now() + 864e5));
  const from = new Date().toISOString(), to = new Date(Date.now() + 2 * 864e5).toISOString();
  const outs = (await db("outings?reminded=eq.false&start_at=gte." + from + "&start_at=lt." + to + "&select=id,group_id,title,place,start_at"))
    .filter((o) => parisDay(new Date(o.start_at)) === tomorrow);
  const report = [];
  for (const o of outs) {
    const rs = await db("outing_rsvps?outing_id=eq." + o.id + "&status=in.(yes,maybe)&select=user_id,status,seats,needs_ride");
    const yes = rs.filter((r) => r.status === "yes").length, seats = rs.reduce((a, r) => a + (r.seats || 0), 0), need = rs.filter((r) => r.needs_ride).length;
    const hour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(o.start_at)).replace(":", "h");
    const msg = {
      title: "⏰ Demain " + hour + " : " + cut(o.title, 60),
      body: [o.place, yes + " participant" + (yes > 1 ? "s" : ""), seats ? "🚗 " + seats + " place" + (seats > 1 ? "s" : "") + " en voiture" : null, need ? need + " cherche" + (need > 1 ? "nt" : "") + " une place" : null].filter(Boolean).join(" · "),
      url: "./#groupe", tag: "outr-" + o.id,
    };
    let sent = 0;
    for (const r of rs) {
      // stock d'appâts bas : on le rappelle la veille de la sortie
      let m = msg;
      try {
        const st = await db("bait_stock?user_id=eq." + r.user_id + "&low_at=not.is.null&select=name,qty,low_at,unit");
        const low = st.filter((x) => Number(x.qty) <= Number(x.low_at));
        if (low.length) m = { ...msg, body: msg.body + " · 🥣 Stock bas : " + low.slice(0, 3).map((x) => x.name + " (" + num(Math.round(x.qty * 100) / 100) + " " + x.unit + ")").join(", ") };
      } catch (_) { /* pas de stock */ }
      sent += await pushTo(r.user_id, m, vapid);
    }
    await db("outings?id=eq." + o.id, { method: "PATCH", body: JSON.stringify({ reminded: true }), headers: { Prefer: "return=minimal" } });
    report.push({ id: o.id, people: rs.length, sent });
  }
  return { tomorrow, outings: outs.length, report };
}
