import { q, tx } from './db.js';
import { bad, requireUser, type Ctx } from './http.js';
import { int, rateLimit } from './anticheat.js';
import { checkAchievements, getItems } from './economy.js';
import { DEFAULT_THREAD } from '../src/shared/gameData.js';

export async function shopItems(ctx: Ctx) {
  await requireUser(ctx);
  return { items: await getItems(), defaultThread: DEFAULT_THREAD };
}

/** Server-validated purchase: price & quantity come from DB config, coins are
 *  deducted atomically with a balance check in the same statement. */
export async function buyItem(ctx: Ctx) {
  const u = await requireUser(ctx);
  rateLimit(`buy:${u.id}`, 30, 60 * 1000);
  const itemId = String(ctx.body.itemId || '');
  const count = int(ctx.body.count ?? 1, 'Jumlah', 1, 10);
  return tx(async (c) => {
    const r = await c.query('SELECT data FROM items WHERE id = $1', [itemId]);
    const item = r.rows[0]?.data;
    if (!item || !item.enabled) throw bad('Item tidak tersedia');
    const cost = item.price * count;
    const pay = await c.query('UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1 RETURNING coins', [cost, u.id]);
    if (!pay.rows[0]) throw bad('Coins tidak cukup');
    const inv = await c.query(
      `INSERT INTO inventory (user_id, item_id, qty) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty RETURNING qty`,
      [u.id, item.id, item.qty * count],
    );
    await checkAchievements(c, u.id);
    return { coins: pay.rows[0].coins, qty: inv.rows[0].qty, added: item.qty * count };
  });
}

export async function inventory(ctx: Ctx) {
  const u = await requireUser(ctx);
  const inv = await q<{ item_id: string; qty: number }>('SELECT item_id, qty FROM inventory WHERE user_id = $1 ORDER BY item_id', [u.id]);
  const items = await getItems(undefined, true);
  return {
    inventory: inv.map((i) => ({ ...i, item: items.find((x) => x.id === i.item_id) || null })).filter((i) => i.item),
    equipped: u.equipped_thread,
    defaultThread: DEFAULT_THREAD,
  };
}

export async function equipThread(ctx: Ctx) {
  const u = await requireUser(ctx);
  const itemId = String(ctx.body.itemId || '');
  if (itemId !== DEFAULT_THREAD.id) {
    const r = await q('SELECT qty FROM inventory WHERE user_id = $1 AND item_id = $2 AND qty > 0', [u.id, itemId]);
    if (!r.length) throw bad('Kamu tidak memiliki benang ini');
  }
  await q('UPDATE users SET equipped_thread = $1 WHERE id = $2', [itemId, u.id]);
  return { ok: true };
}
