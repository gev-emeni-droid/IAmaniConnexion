// file: functions/api/[[path]].ts

type Role = { id: string; label: string };

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) {
    return json({ error: "Not an API route" }, 404);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const db = env.DB as unknown as D1Database;
  if (!db) {
    return json({ error: "Database not configured (env.DB missing)" }, 500, request);
  }

  try {
    await ensureAppKv(db);

    // IMPORTANT: keep ids as-is (do NOT lowercase the whole path)
    const apiPath = pathname.replace(/^\/api\/?/, "");
    const parts = apiPath.split("/").filter(Boolean);

    const resource = (parts[0] || "").toLowerCase();
    // Allow IDs to contain slashes (e.g. "ENCADREMENT / MANAGERS")
    // Since we don't have nested resources like /roles/123/sub, we can join the rest.
    const rawId = parts.slice(1).join('/');
    const id = decodeURIComponent(rawId);

    if (resource === "health" && request.method === "GET") {
      return json({ status: "ok", ts: new Date().toISOString() }, 200, request);
    }

    if (resource === "debug" && request.method === "GET") {
      const keys = await listAppKvKeys(db);
      return json({ keys }, 200, request);
    }

    // ===== Maintenance: one-time cleanup =====
    if (resource === "maintenance" && (parts[1] || "").toLowerCase() === "canonicalize-roles") {
      const confirm = url.searchParams.get("confirm");
      if (confirm !== "YES") {
        return json(
          { error: "Add ?confirm=YES to run the cleanup" },
          400,
          request
        );
      }

      const pref = await preferredRoleIdMap(db);

      // helper to read/write keeping original shape (array/object map)
      const cleanKvCollection = async (kvKey: string) => {
        const raw = await getCollectionRaw(db, kvKey);
        const shape =
          Array.isArray(raw) ? "array" : typeof raw === "object" && raw ? "object" : "empty";
        const items = normalizeToArray(raw);

        const cleaned = items.map((x: any) => canonicalizeAllRoles(structuredClone(x), pref));
        await writeBack(db, kvKey, shape, raw, cleaned);
        return { kvKey, count: cleaned.length };
      };

      const results: any[] = [];
      results.push(await cleanKvCollection("polpo_plannings"));
      results.push(await cleanKvCollection("polpo_templates"));
      results.push(await cleanKvCollection("polpo_employees"));

      // dedupe polpo_roles itself (keep best casing)
      const rolesRaw = await getCollectionRaw(db, "polpo_roles");
      const arr = normalizeToArray(rolesRaw);
      const isStringArray = arr.length === 0 || typeof arr[0] === "string";

      const stored = normalizeRoles(rolesRaw);
      const merged = mergeRoles(stored, new Map()); // dedupe by roleKey + preferRoleId

      if (isStringArray) {
        await kvSetJSON(db, "polpo_roles", merged.map((r) => r.id));
      } else {
        await kvSetJSON(db, "polpo_roles", merged);
      }

      results.push({ kvKey: "polpo_roles", count: merged.length });

      return json({ ok: true, results }, 200, request);
    }

    // Maintenance: force reset roles to standard 8
    if (resource === "maintenance" && (parts[1] || "").toLowerCase() === "reset-roles") {
      const confirm = url.searchParams.get("confirm");
      if (confirm !== "YES") {
        return json(
          { error: "Add ?confirm=YES to reset roles" },
          400,
          request
        );
      }

      const STANDARD_ROLES = [
        { id: 'COMMERCIAL + ADMIN', label: 'COMMERCIAL + ADMIN' },
        { id: 'RUNNER', label: 'RUNNER' },
        { id: 'ACCUEIL', label: 'ACCUEIL' },
        { id: 'ENCADREMENT', label: 'ENCADREMENT' },
        { id: 'BARMAN', label: 'BARMAN' },
        { id: 'CHEF DE RANG', label: 'CHEF DE RANG' },
        { id: 'PLAGE / RUNNER', label: 'PLAGE / RUNNER' },
        { id: 'APPRENTI', label: 'APPRENTI' }
      ];

      // Force write the exact 8 roles
      await kvSetJSON(db, "polpo_roles", STANDARD_ROLES);

      return json({ ok: true, roles: STANDARD_ROLES }, 200, request);
    }

    if (resource === "bootstrap" && request.method === "GET") {
      const employees = await getCollection(db, "polpo_employees");
      const templates = await getCollection(db, "polpo_templates");
      const plannings = await getCollection(db, "polpo_plannings");
      const longAbsences = await getCollection(db, "polpo_long_absences");

      const rolesRaw = await getCollectionRaw(db, "polpo_roles");
      let storedRoles = normalizeRoles(rolesRaw);

      // --- NUKE STUBBORN ROLES ---
      // 1. Remove from stored list
      const originalCount = storedRoles.length;
      storedRoles = storedRoles.filter(r => !BANNED_KEYS.has(roleKey(r.id)));

      // If we filtered something, save back immediately to clean DB
      if (storedRoles.length !== originalCount) {
        const isStringArray = Array.isArray(rolesRaw) && (rolesRaw.length === 0 || typeof rolesRaw[0] === "string");
        if (isStringArray) {
          await kvSetJSON(db, "polpo_roles", storedRoles.map(r => r.id));
        } else {
          await kvSetJSON(db, "polpo_roles", storedRoles);
        }
      }

      // discovery now internally filters BANNED_KEYS
      const discovered = discoverRoleRawByKey(employees, templates, plannings);
      const roles = mergeRoles(storedRoles, discovered);

      const pref = await preferredRoleIdMap(db);

      // 3. Remap banned roles in data to 'ENCADREMENT' (best guess) or "" to kill them
      const remapBanned = (obj: any) => {
        // Helper to check and replace values
        const check = (val: string) => {
          if (BANNED_KEYS.has(roleKey(val))) return "ENCADREMENT"; // Migrating to valid role
          return val;
        };

        if (obj.role) obj.role = check(obj.role);
        if (obj.employeeRole) obj.employeeRole = check(obj.employeeRole);
        return obj;
      };

      // IMPORTANT: return canonicalized data so the UI doesn't show runner + RUNNER
      // AND apply the banned remapping
      const employeesC = employees.map((x: any) => remapBanned(canonicalizeAllRoles(structuredClone(x), pref)));
      const templatesC = templates.map((x: any) => remapBanned(canonicalizeAllRoles(structuredClone(x), pref)));
      const planningsC = plannings.map((x: any) => {
        const cleanP = canonicalizeAllRoles(structuredClone(x), pref);
        if (cleanP.rows && Array.isArray(cleanP.rows)) {
          cleanP.rows = cleanP.rows.map((r: any) => remapBanned(r));
        }
        return cleanP;
      });

      const settings = (await kvGetJSON<Record<string, any>>(db, "polpo_settings_global")) ?? {};

      return json(
        { employees: employeesC, templates: templatesC, plannings: planningsC, roles, longAbsences, settings },
        200,
        request
      );
    }

    if (resource === "employees") {
      return await handleObjectCollection(db, request, "polpo_employees", id, request);
    }

    if (resource === "templates") {
      return await handleObjectCollection(db, request, "polpo_templates", id, request);
    }

    if (resource === "plannings") {
      return await handleObjectCollection(db, request, "polpo_plannings", id, request);
    }

    if (resource === "longabsences") {
      return await handleObjectCollection(db, request, "polpo_long_absences", id, request);
    }

    if (resource === "roles") {
      return await handleRoles(db, request, id);
    }

    if (resource === "settings") {
      return await handleSettings(db, request, id);
    }

    return json({ error: "Not Found", path: pathname }, 404, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[API Error]", msg, error);
    return json({ error: "Internal Server Error", details: msg }, 500, request);
  }
};

// ===================== CORS/JSON =====================

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  } as Record<string, string>;
}

function json(data: any, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: req ? corsHeaders(req) : { "Content-Type": "application/json" },
  });
}

// ===================== app_kv helpers =====================

async function ensureAppKv(db: D1Database) {
  await db
    .prepare(`
      CREATE TABLE IF NOT EXISTS app_kv (
        tenant_id TEXT NOT NULL DEFAULT 'default',
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (tenant_id, key)
      )
    `)
    .run();
}

async function kvGetJSON<T>(db: D1Database, key: string, tenant = "default"): Promise<T | null> {
  const res = await db
    .prepare(`SELECT value FROM app_kv WHERE tenant_id = ?1 AND key = ?2 LIMIT 1`)
    .bind(tenant, key)
    .all();

  const row = res.results?.[0] as any;
  if (!row?.value) return null;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function kvSetJSON(db: D1Database, key: string, value: any, tenant = "default") {
  const now = String(Date.now());
  const str = typeof value === "string" ? value : JSON.stringify(value);

  await db
    .prepare(`
      INSERT INTO app_kv (tenant_id, key, value, updated_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(tenant_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
    .bind(tenant, key, str, now)
    .run();
}

async function listAppKvKeys(db: D1Database) {
  const res = await db
    .prepare(
      `SELECT tenant_id, key, length(value) AS bytes, updated_at
       FROM app_kv ORDER BY updated_at DESC LIMIT 50`
    )
    .all();
  return res.results || [];
}

// ===================== Collection normalization =====================

function normalizeToArray(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    if (Array.isArray((raw as any).items)) return (raw as any).items;
    return Object.values(raw);
  }
  return [];
}

async function getCollectionRaw(db: D1Database, kvKey: string) {
  return await kvGetJSON<any>(db, kvKey);
}

async function getCollection(db: D1Database, kvKey: string) {
  const raw = await kvGetJSON<any>(db, kvKey);
  return normalizeToArray(raw);
}

// ===================== Roles keying + merge =====================

const roleKeyRegex =
  /^(role|roles|roleid|role_id|poste|postes|position|fonction|fonctions|job|rank|metier|metiers)$/i;

const stopKeys = new Set([
  "id", "name", "label", "items", "date", "day", "days", "start", "end", "from", "to", "shifts",
  "hours", "total", "week", "month", "year", "created_at", "updated_at", "meta", "data",
]);

// EXPLICITLY BANNED ROLES (Nuclear Option)
// EXPLICITLY BANNED ROLES (Nuclear Option)
const BANNED_ROLES: string[] = ["ENCADREMENT /", "ENCADREMENT / M", "ENCADREMENT / MANAGER", "ENCADREMENT / MANAGERS"];
const BANNED_KEYS = new Set(BANNED_ROLES.map(roleKey));

function stripDiacritics(input: string) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function roleKey(input: string) {
  return stripDiacritics(String(input ?? ""))
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeRoleLabel(rawId: string) {
  const s = String(rawId ?? "").trim();
  if (!s) return "";
  return s.replace(/[_-]+/g, " ").trim().toUpperCase();
}

function scoreRoleId(s: string) {
  const str = String(s ?? "");
  let score = 0;
  if (/[A-Z]/.test(str)) score += 3;
  if (/\s/.test(str)) score += 2;
  if (/-/.test(str)) score += 1;
  if (/_/.test(str)) score -= 1;
  if (str === str.toLowerCase()) score -= 1;
  if (/\//.test(str)) score -= 10; // HEAVY PENALTY FOR SLASH
  return score;
}

function preferRoleId(current: string, candidate: string) {
  return scoreRoleId(candidate) > scoreRoleId(current) ? candidate : current;
}

function normalizeRoles(raw: any): Role[] {
  const arr = normalizeToArray(raw);

  if (arr.length > 0 && typeof arr[0] === "string") {
    return (arr as string[]).map((s) => {
      const id = String(s).trim();
      return { id, label: makeRoleLabel(id) || id };
    });
  }

  return arr
    .map((x: any) => {
      const id = String(x?.id ?? x?.label ?? "").trim();
      if (!id) return null;
      const label = String(x?.label ?? makeRoleLabel(id) ?? id);
      return { id, label };
    })
    .filter(Boolean) as Role[];
}

function mergeRoles(stored: Role[], discovered: Map<string, string>): Role[] {
  const map = new Map<string, Role>();

  for (const r of stored) {
    const k = roleKey(r.id);
    // BAN CHECK
    if (BANNED_KEYS.has(k)) continue;

    const existing = map.get(k);
    if (!existing) {
      map.set(k, { id: r.id, label: r.label ?? makeRoleLabel(r.id) ?? r.id });
    } else {
      const nextId = preferRoleId(existing.id, r.id);
      map.set(k, {
        id: nextId,
        label: existing.label || r.label || makeRoleLabel(nextId) || nextId,
      });
    }
  }

  for (const [k, rawId] of discovered.entries()) {
    // BAN CHECK
    if (BANNED_KEYS.has(k)) continue;

    const existing = map.get(k);
    if (!existing) {
      map.set(k, { id: rawId, label: makeRoleLabel(rawId) || rawId });
    } else {
      const upgradedId = preferRoleId(existing.id, rawId);
      const oldAuto = existing.label === makeRoleLabel(existing.id);
      const nextLabel = oldAuto ? makeRoleLabel(upgradedId) : existing.label;
      map.set(k, { id: upgradedId, label: nextLabel || makeRoleLabel(upgradedId) || upgradedId });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

function looksLikeRoleNameKey(k: string) {
  const key = String(k ?? "").trim();
  if (!key) return false;
  const low = key.toLowerCase();
  if (stopKeys.has(low)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(key)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  if (key.length > 40) return false;
  return true;
}

function discoverRoleRawByKey(employees: any[], templates: any[], plannings: any[]) {
  const out = new Map<string, string>();

  const addValue = (v: any) => {
    if (typeof v === "string" && v.trim()) {
      const raw = v.trim();
      const k = roleKey(raw);
      // BAN CHECK
      if (BANNED_KEYS.has(k)) return;

      const existing = out.get(k);
      out.set(k, existing ? preferRoleId(existing, raw) : raw);
    } else if (Array.isArray(v)) {
      v.forEach(addValue);
    } else if (v && typeof v === "object") {
      if (typeof (v as any).id === "string") addValue((v as any).id);
      if (typeof (v as any).role === "string") addValue((v as any).role);
      if (typeof (v as any).roleId === "string") addValue((v as any).roleId);
      if (typeof (v as any).poste === "string") addValue((v as any).poste);
      if (typeof (v as any).label === "string") addValue((v as any).label);
    }
  };

  const walk = (node: any, depth = 0) => {
    if (!node || depth > 8) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return;

    if (Array.isArray(node)) {
      for (const it of node) walk(it, depth + 1);
      return;
    }

    if (typeof node === "object") {
      // also scan KEYS (roles sometimes are object keys!)
      for (const k of Object.keys(node)) {
        if (looksLikeRoleNameKey(k)) addValue(k);
      }

      for (const [k, v] of Object.entries(node)) {
        if (roleKeyRegex.test(k)) addValue(v);
        walk(v, depth + 1);
      }
    }
  };

  walk(employees);
  walk(templates);
  walk(plannings);

  return out;
}

async function preferredRoleIdMap(db: D1Database) {
  const rolesRaw = await getCollectionRaw(db, "polpo_roles");
  const stored = normalizeRoles(rolesRaw);

  const employees = await getCollection(db, "polpo_employees");
  const templates = await getCollection(db, "polpo_templates");
  const plannings = await getCollection(db, "polpo_plannings");

  const discovered = discoverRoleRawByKey(employees, templates, plannings);
  const merged = mergeRoles(stored, discovered);

  const map = new Map<string, string>();
  for (const r of merged) map.set(roleKey(r.id), r.id);
  return map;
}

// ===================== Canonicalize roles in VALUES + KEYS =====================

function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(a: any, b: any) {
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  if (isPlainObject(a) && isPlainObject(b)) {
    const out: any = { ...a };
    for (const [k, v] of Object.entries(b)) {
      if (k in out) out[k] = deepMerge(out[k], v);
      else out[k] = v;
    }
    return out;
  }
  // keep existing 'a' by default
  return a ?? b;
}

// This fixes both:
// - values like { role: "runner" }
// - AND object keys like { runner: {...}, RUNNER: {...} }
function canonicalizeAllRoles(obj: any, preferredByKey: Map<string, string>) {
  const canonicalizeValue = (v: any): any => {
    if (typeof v === "string") {
      return preferredByKey.get(roleKey(v)) ?? v;
    }
    if (Array.isArray(v)) return v.map(canonicalizeValue);
    if (isPlainObject(v)) return v; // walked later
    return v;
  };

  const walk = (node: any, depth = 0) => {
    if (!node || depth > 10) return;

    if (Array.isArray(node)) {
      node.forEach((it) => walk(it, depth + 1));
      return;
    }

    if (!isPlainObject(node)) return;

    // 1) rename keys if key itself matches a role
    const keys = Object.keys(node);
    for (const k of keys) {
      const pref = preferredByKey.get(roleKey(k));
      if (pref && pref !== k) {
        if (pref in node) {
          (node as any)[pref] = deepMerge((node as any)[pref], (node as any)[k]);
        } else {
          (node as any)[pref] = (node as any)[k];
        }
        delete (node as any)[k];
      }
    }

    // 2) canonicalize role fields values
    for (const [k, v] of Object.entries(node)) {
      if (roleKeyRegex.test(k)) {
        (node as any)[k] = canonicalizeValue(v);
      }
    }

    // 3) recurse
    for (const v of Object.values(node)) walk(v, depth + 1);
  };

  walk(obj);
  return obj;
}

// ===================== CRUD handlers =====================

async function handleObjectCollection(
  db: D1Database,
  req: Request,
  kvKey: string,
  id: string | undefined,
  corsReq: Request
) {
  const raw = await getCollectionRaw(db, kvKey);
  const shape = Array.isArray(raw) ? "array" : typeof raw === "object" && raw ? "object" : "empty";
  const items = normalizeToArray(raw);

  const shouldCanonicalizeRoles =
    kvKey === "polpo_plannings" || kvKey === "polpo_templates" || kvKey === "polpo_employees";

  if (req.method === "GET" && !id) {
    return json(items, 200, corsReq);
  }

  if (req.method === "GET" && id) {
    const found = items.find((x: any) => String(x?.id) === String(id));
    return json(found ?? {}, found ? 200 : 404, corsReq);
  }

  if (req.method === "POST") {
    const body = await safeJson(req);
    const newId = crypto.randomUUID();

    let nextItem: any = { id: newId, ...(body ?? {}) };
    if (shouldCanonicalizeRoles) {
      const pref = await preferredRoleIdMap(db);
      nextItem = canonicalizeAllRoles(nextItem, pref);
    }

    const next = [...items, nextItem];
    await writeBack(db, kvKey, shape, raw, next);
    return json({ ok: true, id: newId }, 201, corsReq);
  }

  if (req.method === "PUT" && id) {
    const body = await safeJson(req);

    const pref = shouldCanonicalizeRoles ? await preferredRoleIdMap(db) : null;

    const idx = items.findIndex((x: any) => String(x?.id) === String(id));
    if (idx >= 0) {
      let merged: any = { ...items[idx], ...(body ?? {}), id };
      if (pref) merged = canonicalizeAllRoles(merged, pref);
      items[idx] = merged;
    } else {
      let merged: any = { id, ...(body ?? {}) };
      if (pref) merged = canonicalizeAllRoles(merged, pref);
      items.push(merged);
    }

    await writeBack(db, kvKey, shape, raw, items);
    return json({ ok: true }, 200, corsReq);
  }

  if (req.method === "DELETE" && id) {
    const next = items.filter((x: any) => String(x?.id) !== String(id));
    await writeBack(db, kvKey, shape, raw, next);
    return json({ ok: true }, 200, corsReq);
  }

  return json({ error: "Method Not Allowed" }, 405, corsReq);
}

async function handleRoles(db: D1Database, req: Request, id?: string) {
  const raw = await getCollectionRaw(db, "polpo_roles");
  const arr = normalizeToArray(raw);
  const isStringArray = arr.length === 0 || typeof arr[0] === "string";

  const stored = normalizeRoles(raw).filter(r => !BANNED_KEYS.has(roleKey(r.id)));

  const employees = await getCollection(db, "polpo_employees");
  const templates = await getCollection(db, "polpo_templates");
  const plannings = await getCollection(db, "polpo_plannings");

  const discovered = discoverRoleRawByKey(employees, templates, plannings);
  const merged = mergeRoles(stored, discovered);

  if (req.method === "GET" && !id) {
    // Return ONLY stored roles, NO auto-discovery
    return json(stored, 200, req);
  }

  if (req.method === "GET" && id) {
    const target = roleKey(id);
    const found = merged.find((r) => roleKey(r.id) === target);
    return json(found ?? {}, found ? 200 : 404, req);
  }

  if (req.method === "PUT" && id) {
    const body = await safeJson(req);
    const targetKey = roleKey(id);
    const wantRaw = String(body?.id ?? body?.label ?? id).trim() || id;

    if (isStringArray) {
      const current = (arr as any[]).map(String);
      const existing = current.find((s) => roleKey(s) === targetKey);
      const toStore = existing ? preferRoleId(existing, wantRaw) : wantRaw;

      const next = current.filter((s) => roleKey(s) !== targetKey);
      next.push(toStore);

      await kvSetJSON(db, "polpo_roles", next);
    } else {
      const list = normalizeRoles(raw);
      const idx = list.findIndex((r) => roleKey(r.id) === targetKey);
      if (idx >= 0) {
        list[idx] = {
          id: preferRoleId(list[idx].id, wantRaw),
          label: String(body?.label ?? list[idx].label ?? makeRoleLabel(wantRaw)),
        };
      } else {
        list.push({ id: wantRaw, label: String(body?.label ?? makeRoleLabel(wantRaw)) });
      }
      await kvSetJSON(db, "polpo_roles", list);
    }

    return json({ ok: true }, 200, req);
  }

  if (req.method === "POST") {
    const body = await safeJson(req);
    const newId = String(body?.id || body?.label || '').trim();
    const newLabel = String(body?.label || newId).trim();

    if (!newId) {
      return json({ error: "ID or label required" }, 400, req);
    }

    if (isStringArray) {
      const current = (arr as any[]).map(String);
      if (!current.includes(newId)) {
        current.push(newId);
        await kvSetJSON(db, "polpo_roles", current);
      }
    } else {
      const list = normalizeRoles(raw);
      if (!list.find(r => r.id === newId)) {
        list.push({ id: newId, label: newLabel });
        await kvSetJSON(db, "polpo_roles", list);
      }
    }
    return json({ ok: true }, 201, req);
  }

  if (req.method === "DELETE" && id) {
    const targetKey = roleKey(id);

    if (isStringArray) {
      const current = (arr as any[]).map(String);
      const next = current.filter((s) => roleKey(s) !== targetKey);
      await kvSetJSON(db, "polpo_roles", next);
    } else {
      const next = normalizeRoles(raw).filter((r) => roleKey(r.id) !== targetKey);
      await kvSetJSON(db, "polpo_roles", next);
    }
    return json({ ok: true }, 200, req);
  }

  return json({ error: "Method Not Allowed" }, 405, req);
}

async function handleSettings(db: D1Database, req: Request, key?: string) {
  const settings = (await kvGetJSON<Record<string, any>>(db, "polpo_settings_global")) ?? {};

  if (req.method === "GET" && !key) {
    return json(settings, 200, req);
  }

  if (req.method === "GET" && key) {
    return json({ key, value: settings[key] ?? null }, 200, req);
  }

  if (req.method === "PUT" && key) {
    const body = await safeJson(req);
    settings[key] = body?.value ?? null;
    await kvSetJSON(db, "polpo_settings_global", settings);
    return json({ ok: true }, 200, req);
  }

  if (req.method === "DELETE" && key) {
    delete settings[key];
    await kvSetJSON(db, "polpo_settings_global", settings);
    return json({ ok: true }, 200, req);
  }

  return json({ error: "Method Not Allowed" }, 405, req);
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function writeBack(db: D1Database, kvKey: string, shape: string, raw: any, items: any[]) {
  if (shape === "object" && raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (Array.isArray((raw as any).items)) {
      await kvSetJSON(db, kvKey, { ...(raw as any), items });
      return;
    }
    const map: Record<string, any> = {};
    for (const it of items) {
      const k = it?.id ? String(it.id) : crypto.randomUUID();
      map[k] = it;
    }
    await kvSetJSON(db, kvKey, map);
    return;
  }

  await kvSetJSON(db, kvKey, items);
}

// ===================== Types =====================

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run(): Promise<any>;
  all(): Promise<{ results?: any[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface PagesFunction {
  (context: any): Response | Promise<Response>;
}
