// functions/api/state.ts

// Petit helper pour renvoyer du JSON proprement
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET  /api/state  → lire l'état sauvegardé
export async function onRequestGet(context: any) {
  const { env } = context;

  const db = env['polpo-direction'];
  if (!db) {
    return jsonResponse({ error: 'D1 polpo-direction non disponible' }, 500);
  }

  // Crée la table si elle n'existe pas
  await db
    .prepare(`
      CREATE TABLE IF NOT EXISTS direction_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    .run();

  // On lit la ligne unique "state"
  const result = await db
    .prepare('SELECT value FROM direction_state WHERE key = ?1;')
    .bind('state')
    .all();

  const row = result.results && result.results[0] as { value?: string } | undefined;

  if (!row || !row.value) {
    // Aucun état encore sauvegardé
    return jsonResponse({ exists: false, state: null }, 200);
  }

  let state: any = null;
  try {
    state = JSON.parse(row.value);
  } catch {
    state = null;
  }

  return jsonResponse({ exists: true, state }, 200);
}

// POST /api/state  → sauvegarder l'état complet du planning
export async function onRequestPost(context: any) {
  const { request, env } = context;

  const db = env['polpo-direction'];
  if (!db) {
    return jsonResponse({ error: 'D1 polpo-direction non disponible' }, 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'JSON invalide' }, 400);
  }

  // Crée la table si elle n'existe pas
  await db
    .prepare(`
      CREATE TABLE IF NOT EXISTS direction_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    .run();

  // Sauvegarde / remplace l'unique ligne "state"
  await db
    .prepare(
      'INSERT OR REPLACE INTO direction_state (key, value) VALUES (?1, ?2);'
    )
    .bind('state', JSON.stringify(body))
    .run();

  return jsonResponse({ ok: true }, 200);
}
