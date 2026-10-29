// Coup du Jour : bibliothèque d'envoi des notifications (utilisée par la fonction Supabase « notify »)
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

export async function handle(req, cfg) {
  SB_URL = cfg.url; SB_KEY = cfg.key;
  const HOOK_SECRET = cfg.secret, VAPID = cfg.vapid;
  if (req.headers.get("x-hook-secret") !== HOOK_SECRET) return new Response("forbidden", { status: 403 });
  try {
    const { table, id } = await req.json();
    if (table !== "posts" && table !== "spots") return new Response("bad table", { status: 400 });
    const cols = table === "posts"
      ? "id,group_id,user_id,species,length_cm,weight_kg,caption,photo_path,photo_paths"
      : "id,group_id,user_id,name";
    const [rec] = await db(table + "?id=eq." + Number(id) + "&select=" + cols);
    if (!rec) return Response.json({ sent: 0, reason: "introuvable" });
    const [groups, users, members] = await Promise.all([
      db("groups?id=eq." + rec.group_id + "&select=name"),
      db("profiles?id=eq." + rec.user_id + "&select=username"),
      db("memberships?group_id=eq." + rec.group_id + "&user_id=neq." + rec.user_id + "&select=user_id"),
    ]);
    if (!members.length) return Response.json({ sent: 0, reason: "aucun autre membre" });
    const subs = await db("push_subs?user_id=in.(" + members.map((m) => m.user_id).join(",") + ")&select=endpoint,p256dh,auth");
    if (!subs.length) return Response.json({ sent: 0, reason: "aucun abonné" });
    const group = groups[0]?.name || "ton groupe", who = "@" + (users[0]?.username || "quelqu'un");
    let msg;
    if (table === "posts") {
      const n = (rec.photo_paths && rec.photo_paths.length) || (rec.photo_path ? 1 : 0);
      const parts = [rec.species, rec.length_cm ? num(rec.length_cm) + " cm" : "", rec.weight_kg ? num(rec.weight_kg) + " kg" : ""].filter(Boolean);
      let text = parts.join(" · ") || (rec.caption || "").slice(0, 90) || (n ? "nouvelle photo" : "nouveau post");
      if (n > 1) text += " · " + n + " photos";
      msg = { title: "🎣 Nouvelle prise · " + group, body: who + " : " + text, url: "./#fil", tag: "post-" + rec.id };
    } else {
      msg = { title: "📍 Nouveau spot · " + group, body: who + " a ajouté « " + rec.name + " »", url: "./#carte", tag: "spot-" + rec.id };
    }
    const payload = JSON.stringify(msg);
    const results = await Promise.allSettled(subs.map(async (s) => {
      const r = await sendPush(s, payload, VAPID);
      if (r.status === 404 || r.status === 410) {
        await db("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
      }
      return r.status;
    }));
    return Response.json({ sent: subs.length, results: results.map((x) => x.status === "fulfilled" ? x.value : String(x.reason)) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
