// Coup du Jour : bibliothèque d'envoi des notifications (utilisée par la fonction Supabase « notify »)
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
export async function sendPush(sub, payloadText, vapid) {
  const body = await encryptPayload(sub.p256dh, sub.auth, payloadText);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Urgency": "normal",
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
    db("profiles?is_admin=eq.true&select=id"),
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
        msg = { title: "🙋 Demande d'adhésion · " + group, body: who + " veut rejoindre le groupe", url: "./#groupe", tag: "req-" + group_id };
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
        msg = { title: "🕓 Prise à valider · " + group, body: who + " : " + text, url: "./#fil", tag: "pend-" + rec.id };
      } else {
        recipients = await activeMembers(group_id, author);
        msg = { title: "🎣 Nouvelle prise · " + group, body: who + " : " + text, url: "./#fil", tag: "post-" + rec.id };
      }
    } else {
      recipients = await activeMembers(group_id, author);
      if (t === "spots") msg = { title: "📍 Nouveau spot · " + group, body: who + " a ajouté « " + rec.name + " »", url: "./#carte", tag: "spot-" + rec.id };
      else if (t === "polls") msg = { title: "📊 Sondage · " + group, body: who + " : " + cut(rec.question, 110) + (rec.place ? " (" + rec.place + ")" : ""), url: "./#groupe", tag: "poll-" + rec.id };
      else if (t === "memos") msg = { title: "📌 Nouveau mémo · " + group, body: who + " : " + cut(rec.title, 100), url: "./#groupe", tag: "memo-" + rec.id };
      else if (t === "sessions") {
        const fish = rec.caught === false ? (rec.species ? rec.species + " ciblé, capot" : "capot") : [rec.species, rec.length_cm ? num(rec.length_cm) + " cm" : ""].filter(Boolean).join(" ");
        const combo = [rec.lure, rec.color].filter(Boolean).join(" ");
        msg = { title: "🧾 Bilan de session · " + group, body: who + " : " + [fish, combo, RATING[rec.rating]].filter(Boolean).join(" · "), url: "./#groupe", tag: "sess-" + rec.id };
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

// ---- Alerte du matin : bonnes conditions + rappels d'ouverture ----
async function pushTo(user_id, msg, vapid) {
  const subs = await db("push_subs?user_id=eq." + user_id + "&select=endpoint,p256dh,auth");
  const payload = JSON.stringify(msg);
  let ok = 0;
  await Promise.allSettled(subs.map(async (s) => {
    const r = await sendPush(s, payload, vapid);
    if (r.status === 404 || r.status === 410) await db("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
    else if (r.ok) ok++;
  }));
  return ok;
}
async function morning(ev, vapid) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const test = ev.test === true && /^[0-9a-f-]{36}$/i.test(String(ev.user_id || ""));
  let q = "alert_prefs?enabled=eq.true&select=user_id,lat,lon,place,species,threshold,water,opening,last_sent";
  if (test) q = "alert_prefs?user_id=eq." + ev.user_id + "&select=user_id,lat,lon,place,species,threshold,water,opening,last_sent";
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
    if (test && !msgs.length) msgs.push({ title: "🧪 Test · Alerte du matin", body: "Les alertes fonctionnent. Ajoute ta position pour recevoir les conditions.", url: "./#profil", tag: "morning" });
    let sent = 0;
    for (const m of msgs) sent += await pushTo(p.user_id, m, vapid);
    if (!test && msgs.length) await db("alert_prefs?user_id=eq." + p.user_id, { method: "PATCH", body: JSON.stringify({ last_sent: today }), headers: { Prefer: "return=minimal" } });
    report.push({ msgs: msgs.length, sent });
  }
  return { day: today, users: prefs.length, report };
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
    for (const r of rs) sent += await pushTo(r.user_id, msg, vapid);
    await db("outings?id=eq." + o.id, { method: "PATCH", body: JSON.stringify({ reminded: true }), headers: { Prefer: "return=minimal" } });
    report.push({ id: o.id, people: rs.length, sent });
  }
  return { tomorrow, outings: outs.length, report };
}
