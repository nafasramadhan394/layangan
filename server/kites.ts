import { q, one, tx } from './db.js';
import { bad, requireUser, type Ctx } from './http.js';
import { cleanText, num, rateLimit, sanitizeDesign, validateKiteImage } from './anticheat.js';
import { checkAchievements } from './economy.js';
import { MAX_KITES_PER_USER } from './config.js';

export async function listKites(ctx: Ctx) {
  const u = await requireUser(ctx);
  const kites = await q('SELECT id, name, image, design, size, custom, created_at FROM kites WHERE user_id = $1 ORDER BY id', [u.id]);
  return { kites, selected: u.selected_kite };
}

export async function createKite(ctx: Ctx) {
  const u = await requireUser(ctx);
  rateLimit(`kite:${u.id}`, 15, 60 * 60 * 1000);
  const name = cleanText(ctx.body.name, 'Nama layangan', 2, 24);
  const size = num(ctx.body.size, 'Ukuran', 0.7, 1.4);
  const image = validateKiteImage(ctx.body.image);
  const design = { ...sanitizeDesign(ctx.body.design), style: 'image' };
  return tx(async (c) => {
    const n = (await c.query('SELECT count(*)::int AS n FROM kites WHERE user_id = $1', [u.id])).rows[0].n;
    if (n >= MAX_KITES_PER_USER) throw bad(`Maksimal ${MAX_KITES_PER_USER} layangan`);
    const r = await c.query(
      `INSERT INTO kites (user_id, name, image, design, size, custom) VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [u.id, name, image, design, size],
    );
    if (ctx.body.select === true) await c.query('UPDATE users SET selected_kite = $1 WHERE id = $2', [r.rows[0].id, u.id]);
    const ach = await checkAchievements(c, u.id);
    return { id: r.rows[0].id, achievements: ach };
  });
}

export async function updateKite(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  const name = cleanText(ctx.body.name, 'Nama layangan', 2, 24);
  const size = num(ctx.body.size, 'Ukuran', 0.7, 1.4);
  const r = await q('UPDATE kites SET name = $1, size = $2 WHERE id = $3 AND user_id = $4 RETURNING id', [name, size, id, u.id]);
  if (!r.length) throw bad('Layangan tidak ditemukan');
  return { ok: true };
}

export async function selectKite(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  const k = await one('SELECT id FROM kites WHERE id = $1 AND user_id = $2', [id, u.id]);
  if (!k) throw bad('Layangan tidak ditemukan');
  await q('UPDATE users SET selected_kite = $1 WHERE id = $2', [id, u.id]);
  return { ok: true };
}

export async function deleteKite(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  return tx(async (c) => {
    const n = (await c.query('SELECT count(*)::int AS n FROM kites WHERE user_id = $1', [u.id])).rows[0].n;
    if (n <= 1) throw bad('Kamu harus punya minimal 1 layangan');
    const r = await c.query('DELETE FROM kites WHERE id = $1 AND user_id = $2 RETURNING id', [id, u.id]);
    if (!r.rows[0]) throw bad('Layangan tidak ditemukan');
    await c.query(
      `UPDATE users SET selected_kite = (SELECT id FROM kites WHERE user_id = $1 ORDER BY id LIMIT 1)
       WHERE id = $1 AND (selected_kite = $2 OR selected_kite IS NULL)`,
      [u.id, id],
    );
    return { ok: true };
  });
}

/** Public kite visuals for rendering other players in a match. */
export async function publicKites(ctx: Ctx) {
  await requireUser(ctx);
  const ids = (Array.isArray(ctx.body.ids) ? ctx.body.ids : [])
    .map(Number)
    .filter((n: number) => Number.isInteger(n) && n > 0)
    .slice(0, 12);
  if (!ids.length) return { kites: [] };
  const kites = await q('SELECT id, name, image, design, size FROM kites WHERE id = ANY($1::int[])', [ids]);
  return { kites };
}

export async function listTemplates(ctx: Ctx) {
  const u = await requireUser(ctx);
  const t = await q('SELECT id, name, image, design, size, price FROM kite_templates WHERE enabled ORDER BY price, id');
  const owned = await q<{ template_id: number }>('SELECT template_id FROM kites WHERE user_id = $1 AND template_id IS NOT NULL', [u.id]);
  const set = new Set(owned.map((o) => o.template_id));
  return { templates: t.map((x: any) => ({ ...x, owned: set.has(x.id) })) };
}

/** Buy a kite template — price is read from the DB, never from the client. */
export async function buyTemplate(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  return tx(async (c) => {
    const t = (await c.query('SELECT * FROM kite_templates WHERE id = $1 AND enabled', [id])).rows[0];
    if (!t) throw bad('Layangan tidak tersedia');
    const owned = (await c.query('SELECT 1 FROM kites WHERE user_id = $1 AND template_id = $2', [u.id, id])).rows[0];
    if (owned) throw bad('Kamu sudah memiliki layangan ini');
    const n = (await c.query('SELECT count(*)::int AS n FROM kites WHERE user_id = $1', [u.id])).rows[0].n;
    if (n >= MAX_KITES_PER_USER) throw bad(`Maksimal ${MAX_KITES_PER_USER} layangan`);
    const pay = await c.query('UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1 RETURNING coins', [t.price, u.id]);
    if (!pay.rows[0]) throw bad('Coins tidak cukup');
    const k = await c.query(
      'INSERT INTO kites (user_id, name, image, design, size, template_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [u.id, t.name, t.image, t.design, t.size, t.id],
    );
    return { id: k.rows[0].id, coins: pay.rows[0].coins };
  });
}
