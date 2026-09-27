import { HttpError, type Ctx } from './http.js';
import * as auth from './auth.js';
import * as users from './users.js';
import * as friends from './friends.js';
import * as kites from './kites.js';
import * as shop from './shop.js';
import * as match from './match.js';
import * as mm from './matchmaking.js';
import * as admin from './admin.js';
import { getMaps } from './economy.js';
import { requireUser } from './http.js';
import { ensureSchema } from './db.js';

type Handler = (ctx: Ctx) => Promise<unknown>;

export const routes: Record<string, Handler> = {
  // Authentication
  'auth/register': auth.register,
  'auth/login': auth.login,
  'auth/logout': auth.logout,
  'auth/password': auth.changePassword,
  // Account / currency
  me: users.me,
  'me/heartbeat': users.heartbeat,
  'me/settings': users.saveSettings,
  'me/avatar': users.saveAvatar,
  'daily/claim': users.claimDaily,
  'events/list': users.eventsList,
  'events/claim': users.claimEvent,
  profile: users.profile,
  // Friends
  'friends/list': friends.listFriends,
  'friends/request': friends.requestFriend,
  'friends/respond': friends.respondFriend,
  'friends/remove': friends.removeFriend,
  // Kites
  'kites/list': kites.listKites,
  'kites/create': kites.createKite,
  'kites/update': kites.updateKite,
  'kites/select': kites.selectKite,
  'kites/delete': kites.deleteKite,
  'kites/public': kites.publicKites,
  'kites/templates': kites.listTemplates,
  'kites/buy-template': kites.buyTemplate,
  // Shop & inventory
  'shop/items': shop.shopItems,
  'shop/buy': shop.buyItem,
  'inventory/list': shop.inventory,
  'inventory/equip': shop.equipThread,
  // Maps
  'maps/list': async (ctx) => {
    await requireUser(ctx);
    return { maps: await getMaps() };
  },
  // Matchmaking / multiplayer
  'mm/join': mm.joinQueue,
  'mm/poll': mm.pollQueue,
  'mm/leave': mm.leaveQueue,
  'invites/send': mm.sendInvite,
  'invites/respond': mm.respondInvite,
  'invites/cancel': mm.cancelInvite,
  'match/sync': match.sync,
  'match/leave': match.leave,
  'match/info': match.matchInfo,
  'free/join': match.joinFree,
  'free/rooms': match.freeRooms,
  // Owner panel (all server-side permission checked)
  'admin/overview': admin.overview,
  'admin/match/end': admin.endMatch,
  'admin/players': admin.players,
  'admin/player/coins': admin.setCoins,
  'admin/player/ban': admin.setBan,
  'admin/maps': admin.listMaps,
  'admin/maps/save': admin.saveMap,
  'admin/items': admin.listItems,
  'admin/items/save': admin.saveItem,
  'admin/templates': admin.listTemplatesAdmin,
  'admin/templates/save': admin.saveTemplate,
  'admin/templates/delete': admin.deleteTemplate,
  'admin/rewards': admin.getRewardsAdmin,
  'admin/rewards/save': admin.saveRewards,
  'admin/announcements': admin.listAnnouncements,
  'admin/announcements/save': admin.saveAnnouncement,
  'admin/announcements/delete': admin.deleteAnnouncement,
  'admin/events': admin.listEventsAdmin,
  'admin/events/save': admin.saveEvent,
  'admin/events/delete': admin.deleteEvent,
  health: async () => {
    await ensureSchema();
    return { ok: true, time: Date.now() };
  },
};

export async function dispatch(path: string, ctx: Ctx): Promise<{ status: number; body: unknown }> {
  const h = routes[path];
  if (!h) return { status: 404, body: { error: 'Endpoint tidak ditemukan' } };
  try {
    const body = await h(ctx);
    return { status: 200, body };
  } catch (e: any) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    if (e?.code === '23514') return { status: 400, body: { error: 'Coins tidak cukup' } };
    console.error('API error', path, e?.message);
    return { status: 500, body: { error: 'Terjadi kesalahan server, coba lagi.' } };
  }
}
