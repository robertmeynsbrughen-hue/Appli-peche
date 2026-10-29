// Coup du Jour : fonction Supabase « share » (publique).
// Renvoie les infos d'une prise partagée par lien, sans compte, avec une photo signée pour 7 jours.
const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Cache-Control": "public, max-age=300" };
async function db(path: string) {
  const r = await fetch(URL_ + "/rest/v1/" + path, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f-]{36}$/i.test(t)) return Response.json({ error: "lien invalide" }, { status: 400, headers: CORS });
  try {
    const [sh] = await db("post_shares?token=eq." + t + "&select=post_id,show_spot");
    if (!sh) return Response.json({ error: "introuvable" }, { status: 404, headers: CORS });
    const [p] = await db("posts?id=eq." + sh.post_id + "&status=eq.published&select=id,group_id,user_id,species,length_cm,weight_kg,bait,caption,created_at,photo_path,photo_paths,spot_id");
    if (!p) return Response.json({ error: "introuvable" }, { status: 404, headers: CORS });
    const [[u], [g], spot] = await Promise.all([
      db("profiles?id=eq." + p.user_id + "&select=username"),
      db("groups?id=eq." + p.group_id + "&select=name"),
      sh.show_spot && p.spot_id ? db("spots?id=eq." + p.spot_id + "&select=name") : Promise.resolve([]),
    ]);
    const paths: string[] = (p.photo_paths && p.photo_paths.length) ? p.photo_paths : (p.photo_path ? [p.photo_path] : []);
    const photos: string[] = [];
    for (const path of paths.slice(0, 6)) {
      const r = await fetch(URL_ + "/storage/v1/object/sign/photos/" + path, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 7 * 86400 }) });
      if (r.ok) { const j = await r.json(); if (j.signedURL) photos.push(URL_ + "/storage/v1" + j.signedURL); }
    }
    return Response.json({
      species: p.species, length_cm: p.length_cm, weight_kg: p.weight_kg, bait: p.bait, caption: p.caption,
      date: p.created_at, username: u?.username || "?", group: g?.name || "", spot: spot?.[0]?.name || null, photos,
    }, { headers: CORS });
  } catch (_) {
    return Response.json({ error: "erreur" }, { status: 500, headers: CORS });
  }
});
