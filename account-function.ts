// Rivio : fonction Supabase « account ».
// Ajoute une vraie adresse e-mail à un ancien compte créé avec un simple pseudo (adresse interne fictive),
// sans e-mail de confirmation (l'ancienne adresse fictive ne peut pas recevoir de courrier).
// Action « admin_reset » : l'admin, ou un modérateur pour les membres de son groupe, donne un mot de passe provisoire.
const LEGACY = "@coupdujour.app";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "méthode non autorisée" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  const me = await fetch(url + "/auth/v1/user", { headers: { Authorization: auth, apikey: key } });
  if (!me.ok) return json({ error: "non connecté" }, 401);
  const user = await me.json();
  let body: { email?: string; action?: string; user_id?: string } = {};
  try { body = await req.json(); } catch (_) { /* corps vide */ }
  if (body.action === "admin_reset") return adminReset(url, key, user.id, String(body.user_id || ""));
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ error: "email invalide" }, 400);
  if (email.endsWith(LEGACY)) return json({ error: "email invalide" }, 400);
  if (!String(user.email || "").toLowerCase().endsWith(LEGACY)) return json({ error: "not_legacy" }, 400);
  const r = await fetch(url + "/auth/v1/admin/users/" + user.id, {
    method: "PUT",
    headers: { Authorization: "Bearer " + key, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!r.ok) {
    const t = await r.text();
    return json({ error: /already|registered|exists/i.test(t) ? "already registered" : "échec : " + t.slice(0, 120) }, r.status === 422 ? 409 : 500);
  }
  return json({ ok: true, email });
});

const db = (url: string, key: string, path: string, init: RequestInit = {}) =>
  fetch(url + "/rest/v1/" + path, { ...init, headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) } });
const WORDS = ["brochet", "sandre", "perche", "carpe", "silure", "gardon", "tanche", "chevesne", "barbeau", "aspe"];
function tempPassword() {
  const r = crypto.getRandomValues(new Uint32Array(3));
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return WORDS[r[0] % WORDS.length] + "-" + String(r[1] % 10000).padStart(4, "0") + "-" + L[r[2] % L.length] + L[(r[2] >> 8) % L.length];
}
async function adminReset(url: string, key: string, me: string, target: string) {
  if (!/^[0-9a-f-]{36}$/i.test(target)) return json({ error: "membre introuvable" }, 400);
  if (target === me) return json({ error: "Change ton propre mot de passe dans Réglages › Compte" }, 400);
  const [pr, tr] = await Promise.all([
    db(url, key, "profiles?id=eq." + me + "&select=is_admin").then((r) => r.json()),
    db(url, key, "profiles?id=eq." + target + "&select=username,is_admin").then((r) => r.json()),
  ]);
  if (!tr[0]) return json({ error: "membre introuvable" }, 404);
  const isAdmin = !!pr[0]?.is_admin;
  if (!isAdmin) {
    if (tr[0].is_admin) return json({ error: "non autorisé" }, 403);
    // modérateur ou responsable d'un groupe où la cible est simple membre
    const [mine, theirs] = await Promise.all([
      db(url, key, "memberships?user_id=eq." + me + "&status=eq.active&role=in.(owner,moderator)&select=group_id").then((r) => r.json()),
      db(url, key, "memberships?user_id=eq." + target + "&select=group_id,role").then((r) => r.json()),
    ]);
    const ok = theirs.some((t: { group_id: number; role: string }) => t.role === "member" && mine.some((m: { group_id: number }) => m.group_id === t.group_id));
    if (!ok) return json({ error: "non autorisé" }, 403);
  }
  const password = tempPassword();
  const r = await fetch(url + "/auth/v1/admin/users/" + target, {
    method: "PUT",
    headers: { Authorization: "Bearer " + key, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) return json({ error: "échec : " + (await r.text()).slice(0, 120) }, 500);
  await db(url, key, "profiles?id=eq." + target, { method: "PATCH", body: JSON.stringify({ pw_temp: true }), headers: { Prefer: "return=minimal" } });
  return json({ ok: true, username: tr[0].username, password });
}
