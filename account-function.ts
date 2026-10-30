// Coup du Jour : fonction Supabase « account ».
// Ajoute une vraie adresse e-mail à un ancien compte créé avec un simple pseudo (adresse interne fictive),
// sans e-mail de confirmation (l'ancienne adresse fictive ne peut pas recevoir de courrier).
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
  let body: { email?: string } = {};
  try { body = await req.json(); } catch (_) { /* corps vide */ }
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
