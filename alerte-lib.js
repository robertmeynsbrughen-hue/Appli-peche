// Rivio : alertes du staff (fonction Supabase « alerte »).
// Aujourd'hui : notification push aux administrateurs quand un membre signale
// un bug. L'entrée du centre de notifications est déjà créée par la base
// (bug_reports_alert) ; ici on ne fait que la notification sur le téléphone.
// Le chiffrement Web Push est celui de notify-lib.js (même code, même dépôt).
import { sendPush } from "./notify-lib.js";

let SB_URL, SB_KEY;
async function db(path, init = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(path + " -> " + r.status + " " + (await r.text()));
  return r.status === 204 ? null : r.json();
}
const cut = (t, n) => (t || "").length > n ? t.slice(0, n - 1) + "…" : (t || "");

async function pushTo(user_id, msg, vapid) {
  const subs = await db("push_subs?user_id=eq." + user_id + "&select=endpoint,p256dh,auth");
  const payload = JSON.stringify(msg);
  let ok = 0;
  await Promise.allSettled(subs.map(async (s) => {
    const r = await sendPush(s, payload, vapid, "normal");
    if (r.status === 404 || r.status === 410) await db("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
    else if (r.ok) ok++;
  }));
  return ok;
}

async function bugAlert(id, vapid) {
  const [b] = await db("bug_reports?id=eq." + Number(id) + "&select=id,user_id,body,screen");
  if (!b) return { sent: 0, reason: "introuvable" };
  const [u] = await db("profiles?id=eq." + b.user_id + "&select=username");
  const admins = await db("profiles?is_admin=eq.true&select=id");
  const msg = {
    title: "🐞 Bug signalé par @" + (u?.username || "?"),
    body: cut(b.body, 140),
    url: "./#profil?mod=bugs",
    tag: "bug-" + b.id,
  };
  let sent = 0;
  for (const a of admins) sent += await pushTo(a.id, msg, vapid);
  return { sent };
}

// cfg = { secret, vapid, url, key } : secret et clés VAPID ne sont jamais dans
// ce dépôt (seulement dans le index.ts déployé, comme pour « notify »).
export async function handle(req, cfg) {
  SB_URL = cfg.url; SB_KEY = cfg.key;
  if (req.headers.get("x-hook-secret") !== cfg.secret) return new Response("forbidden", { status: 403 });
  try {
    const ev = await req.json();
    if (ev.table === "bug_reports") return Response.json(await bugAlert(ev.id, cfg.vapid));
    return Response.json({ skipped: true });
  } catch (e) {
    return Response.json({ error: String(e && e.message || e) }, { status: 500 });
  }
}
