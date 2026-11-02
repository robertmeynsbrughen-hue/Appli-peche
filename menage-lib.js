// Rivio : ménage du stockage (utilisé par la fonction Supabase « menage »).
// Efface par l'API Storage les fichiers que la base a mis en file d'attente
// (prise, message, compte supprimés, avatar remplacé…) et, la nuit, ceux qui ne
// sont plus référencés nulle part. C'est la base qui choisit les fichiers
// (purge_candidates) : un fichier encore utilisé n'est jamais proposé.

let SB_URL, SB_KEY;
async function rpc(name, args) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(name + " -> " + r.status + " " + (await r.text()));
  return r.status === 204 ? null : r.json();
}

export async function purgeFiles(sweep) {
  const rows = (await rpc("purge_candidates", { p_sweep: sweep })) || [];
  const byBucket = {};
  for (const r of rows) (byBucket[r.bucket] ||= new Set()).add(r.name);
  let deleted = 0; const errors = []; const failed = new Set();
  for (const [bucket, set] of Object.entries(byBucket)) {
    const names = [...set];
    for (let i = 0; i < names.length; i += 100) {
      const part = names.slice(i, i + 100);
      const r = await fetch(SB_URL + "/storage/v1/object/" + bucket, {
        method: "DELETE",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: part }),
      });
      if (r.ok) deleted += ((await r.json()) || []).length;
      else { errors.push(bucket + " " + r.status); part.forEach((n) => failed.add(bucket + "/" + n)); }
    }
  }
  const ok = rows.filter((r) => r.id && !failed.has(r.bucket + "/" + r.name)).map((r) => r.id);
  const ko = rows.filter((r) => r.id && failed.has(r.bucket + "/" + r.name)).map((r) => r.id);
  if (ok.length) await rpc("purge_done", { p_ids: ok, p_ok: true });
  if (ko.length) await rpc("purge_done", { p_ids: ko, p_ok: false, p_error: errors.join("; ") });
  return { deleted, errors };
}

// cfg = { secret, url, key } : le secret est le même que celui de « notify »,
// il n'est jamais dans ce dépôt (seulement dans le index.ts déployé).
export async function handle(req, cfg) {
  SB_URL = cfg.url; SB_KEY = cfg.key;
  if (req.headers.get("x-hook-secret") !== cfg.secret) return new Response("forbidden", { status: 403 });
  try {
    const ev = await req.json();
    if (ev.table !== "purge") return Response.json({ skipped: true });
    return Response.json(await purgeFiles(!!ev.sweep));
  } catch (e) {
    return Response.json({ error: String(e && e.message || e) }, { status: 500 });
  }
}
