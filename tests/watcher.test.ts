// The watcher end to end: the real edge function (supabase functions serve) reading a mock of the game, crediting
// through the real database. Secrets are made up for each run; the real game is never called.
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { corsFor, seal } from '../supabase/functions/watcher/core.ts';
import { contract, fakeLogin, mockGame, sale } from './mock-game.ts';
import { anon, gold, must, ok, organizer, player, service, stack, type Player } from './helpers.ts';

const PORT = 3299;
const game = mockGame(PORT);
const SEAL_KEY = randomBytes(36).toString('base64url');
const CRON_SECRET = randomBytes(24).toString('base64url');
const FN = `${stack.url}/functions/v1/watcher`;
const LOGIN = fakeLogin(7);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let serve: ChildProcess;
let org: Player;

/** The function, called the way the page calls it (supabase-js sends the signed-in user's session). */
async function invoke(who: Player, body: Record<string, unknown>) {
  const { data, error } = await who.client.functions.invoke('watcher', { body });
  if (!error) return { status: 200, body: data as Record<string, unknown> };
  const res = (error as { context?: Response }).context;
  return { status: res?.status ?? 0, body: res ? ((await res.json().catch(() => ({}))) as Record<string, unknown>) : {} };
}
const look = async () => expect((await invoke(org, { action: 'look' })).status).toBe(200);
const status = async () => must(org.client.rpc('admin_watcher_status')) as Promise<{ on: boolean; error: string | null; login_ends: string; listing: { remaining: number } | null; sales: { id: string; state: string; reason: string | null; gold: number }[] }>;
const saleRow = async (id: string) => must(service.from('game_sales').select('state,reason,gold,deposit_request_id').eq('id', id).single());
const moves = async (p: Player) => must(service.from('gold_moves').select('kind,delta,game_sale').eq('user_id', p.id).order('id'));
const listing = [{ itemType: 'COPPER_RAW', tier: null, pricePerUnit: '112', remaining: '850', expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }];

beforeAll(async () => {
  await game.start();
  const envFile = join(mkdtempSync(join(tmpdir(), 'watcher-env-')), 'env');
  writeFileSync(envFile, `WATCHER_SEAL_KEY=${SEAL_KEY}\nCRON_SECRET=${CRON_SECRET}\nGAME_URL=http://host.docker.internal:${PORT}\nALLOWED_ORIGINS=http://127.0.0.1:5173\n`);
  serve = spawn('npx', ['-y', 'supabase@2.119.0', 'functions', 'serve', '--env-file', envFile], { detached: true, stdio: 'ignore' });
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(FN, { method: 'OPTIONS' })).status === 204) break; } catch { /* not up yet */ }
    await sleep(1000);
  }
  // a fresh watcher: no login, no trades from earlier runs counted as new
  await ok(service.from('watcher_state').update({ token_sealed: null, token_exp: null, since: null, house_id: null, checked_at: null, ok_at: null, error: null, listing: null }).eq('id', 1));
  org = await organizer();
  // the deposit terms the review recommends at a 10% export tax: 1.12 a unit, so a unit credits at least 1 gold
  await ok(org.client.rpc('admin_set_deposit_terms', { p_house_name: 'Bibo4414', p_item: 'COPPER_RAW', p_item_label: 'Raw Copper', p_tier: null as unknown as string, p_price_cents: 112, p_export_tax_pct: 10, p_import_tax_pct: 10 }));
  game.set({ ledger: { rows: [] }, contracts: [], listings: listing });
  const on = await invoke(org, { action: 'login', token: `"${LOGIN}"` }); // pasted with its quotes, as the console prints it
  expect(on.status).toBe(200);
}, 180_000);

afterAll(async () => {
  if (serve?.pid) try { process.kill(-serve.pid, 'SIGTERM'); } catch { /* gone */ }
  await game.stop();
});

beforeEach(() => game.set({ ledger: { rows: [] }, contracts: [], listings: listing }));

describe('the House’s login', () => {
  it('is used to read the game, stored sealed, and never handed back', async () => {
    expect(game.lastLogin()).toBe(LOGIN);
    const stored = await must(service.from('watcher_state').select('token_sealed').eq('id', 1).single());
    expect(stored.token_sealed).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(stored.token_sealed).not.toContain(LOGIN.split('.')[1]!);
    const view = await status();
    expect(JSON.stringify(view)).not.toContain(LOGIN.split('.')[1]!);
    expect(view).toMatchObject({ on: true, error: null, listing: { remaining: 850 } });
    expect(Math.abs(Date.parse(view.login_ends) - (Date.now() + 7 * 86_400_000))).toBeLessThan(120_000);
    expect((await anon().from('watcher_state').select('*')).data ?? []).toEqual([]);
  });

  it('only the organizer can give, use or take it; strangers get nothing', async () => {
    const p = await player();
    expect((await invoke(p, { action: 'login', token: LOGIN })).status).toBe(403);
    expect((await invoke(p, { action: 'look' })).status).toBe(403);
    expect((await invoke(p, { action: 'stop' })).status).toBe(403);
    expect((await fetch(FN, { method: 'POST', body: JSON.stringify({ action: 'tick' }) })).status).toBe(401);
    expect((await invoke(org, { action: 'login', token: 'not-a-login' })).status).toBe(400);
    expect((await invoke(org, { action: 'login', token: fakeLogin(-1) })).status).toBe(400);
    expect((await p.client.rpc('admin_watcher_status')).error).toBeTruthy();
  });
});

describe('crediting', () => {
  it('a purchase at the deposit price credits its buyer what the House received after the tax, once', async () => {
    const a = await player();
    const good = sale(a.username.toUpperCase(), 99, 112, 10); // 110.88 total, 11.08 tax: 99.80, so 99 gold
    game.set({
      ledger: { rows: [good, sale(a.username, 5, 105, 10), sale(a.username, 5, 112, 10, { itemType: 'IRON_RAW' }),
        sale(a.username, 5, 112, 10, { side: 'BOUGHT' }), sale(null, 5, 112, 10), sale(a.username, 5, 112, 10, { book: 'LOCAL' })] },
    });
    await look();
    expect(await gold(a.id)).toBe(99);
    await Promise.all([look(), look(), invoke(a, { action: 'tick' })]);
    expect(await gold(a.id)).toBe(99);
    expect(await moves(a)).toEqual([{ kind: 'deposit', delta: 99, game_sale: `trade:${good.id}` }]);
    expect(await saleRow(`trade:${good.id}`)).toMatchObject({ state: 'deposit', gold: 99 });
    expect(await must(service.from('game_sales').select('id').ilike('name', a.username))).toHaveLength(1); // only the deposit-shaped trade was kept
  });

  it('settles the player’s deposit request with the trade, at what was really paid', async () => {
    const b = await player();
    const asked = await must(b.client.rpc('request_lottery_deposit', { p_amount: 50 }));
    const overclaimed = await must(b.client.rpc('request_lottery_deposit', { p_amount: 70 }));
    const exact = sale(b.username, 50, 112, 10); // 56.00 less 5.60: 50 gold
    const short = sale(b.username, 60, 112, 10, { at: new Date(Date.now() + 1000).toISOString() }); // 67.20 less 6.72: 60 gold, though 70 was claimed
    game.set({ ledger: { rows: [exact, short] } });
    await look();
    const requests = await must(service.from('deposit_requests').select('id,status,game_sale').eq('user_id', b.id).order('id'));
    expect(requests).toEqual([
      { id: asked, status: 'approved', game_sale: `trade:${exact.id}` },
      { id: overclaimed, status: 'approved', game_sale: `trade:${short.id}` },
    ]);
    expect(await gold(b.id)).toBe(110);
  });

  it('an accepted contract that sends the House gold for Raw Copper counts too', async () => {
    const c = await player();
    const good = contract(c.username, 123456); // 1,234.56 gold: 1,234
    game.set({
      contracts: [good, contract(c.username, 5000, { receiver: { id: 'someone-else' } }), contract(c.username, 5000, { status: 'PENDING' }),
        contract(c.username, 5000, { lines: [{ side: 'PROPOSER', asset: 'GOLD', amount: '5000' }, { side: 'RECEIVER', asset: 'ITEM', amount: '1', itemType: 'IRON_RAW' }] })],
    });
    await look();
    expect(await gold(c.id)).toBe(1234);
    expect(await saleRow(`contract:${good.id}`)).toMatchObject({ state: 'deposit', gold: 1234 });
  });

  it('a trade nobody here can claim is logged for the organizer, and never paid later by itself', async () => {
    const name = `Late_${Date.now().toString(36)}`;
    const t = sale(name, 10, 112, 10);
    game.set({ ledger: { rows: [t] } });
    await look();
    expect(await saleRow(`trade:${t.id}`)).toMatchObject({ state: 'other', reason: 'no lottery account has this name' });
    const late = await player(0, name);
    await look();
    expect(await gold(late.id)).toBe(0);
    expect((await status()).sales.find((s) => s.id === `trade:${t.id}`)).toMatchObject({ state: 'other' });
  });

  it('an organizer’s own purchase, and one worth less than a gold after tax, are not deposits', async () => {
    const tiny = await player();
    const own = sale(org.username, 10, 112, 10), small = sale(tiny.username, 1, 112, 15); // 1.12 less 0.16: under a gold
    game.set({ ledger: { rows: [own, small] } });
    await look();
    expect(await saleRow(`trade:${own.id}`)).toMatchObject({ state: 'other', reason: 'an organizer account' });
    expect(await saleRow(`trade:${small.id}`)).toMatchObject({ state: 'other', reason: 'less than 1 gold after the game\'s tax' });
    expect(await gold(tiny.id)).toBe(0);
  });

  it('trades from before the watcher was first turned on stay the organizer’s', async () => {
    const d = await player();
    const old = sale(d.username, 10, 112, 10, { at: new Date(Date.now() - 30 * 86_400_000).toISOString() });
    game.set({ ledger: { rows: [old] } });
    await look();
    expect(await saleRow(`trade:${old.id}`)).toMatchObject({ state: 'old' });
    expect(await gold(d.id)).toBe(0);
  });
});

describe('crediting by hand next to the watcher', () => {
  it('a purchase the organizer already credited by hand is linked to it, not paid again', async () => {
    const e = await player();
    await must(org.client.rpc('admin_credit_gold', { p_username: e.username, p_amount: 30 })); // 30 Raw Copper, the old way
    const t = sale(e.username, 30, 112, 10); // 30 units; the watcher sees it after the organizer was quicker
    game.set({ ledger: { rows: [t] } });
    await look();
    expect(await gold(e.id)).toBe(30);
    expect(await saleRow(`trade:${t.id}`)).toMatchObject({ state: 'deposit' });
    expect(await moves(e)).toEqual([{ kind: 'credit', delta: 30, game_sale: `trade:${t.id}` }]);
  });

  it('approving a request by hand asks first when the game shows no such trade', async () => {
    const f = await player();
    const id = await must(f.client.rpc('request_lottery_deposit', { p_amount: 40 }));
    const first = await org.client.rpc('admin_process_deposit', { p_request_id: id, p_approve: true });
    expect(first.error?.message).toMatch(/^NO_TRADE: /);
    expect(await gold(f.id)).toBe(0);
    await must(org.client.rpc('admin_process_deposit', { p_request_id: id, p_approve: true, p_force: true }));
    expect(await gold(f.id)).toBe(40);
  });

  it('approving a second request for a trade the watcher already paid is refused', async () => {
    const g = await player();
    const t = sale(g.username, 20, 112, 10); // 20 gold
    game.set({ ledger: { rows: [t] } });
    await look();
    expect(await gold(g.id)).toBe(20);
    const again = await must(g.client.rpc('request_lottery_deposit', { p_amount: 20 }));
    expect((await org.client.rpc('admin_process_deposit', { p_request_id: again, p_approve: true })).error?.message).toMatch(/would pay it twice/);
    await must(org.client.rpc('admin_process_deposit', { p_request_id: again, p_approve: false }));
    expect(await gold(g.id)).toBe(20);
  });
});

describe('when the game says no', () => {
  it('stops, says why, credits nothing, and recovers on the next good look', async () => {
    const h = await player();
    const t = sale(h.username, 10, 112, 10);
    for (const [fixture, why] of [[{ status: 401 }, /run out/], [{ status: 429 }, /refused the request \(429\)/], [{ html: true }, /web page/], [{ ledger: { rows: [{ id: 7 }] } }, /shape the watcher doesn’t know|shape the watcher doesn't know/]] as const) {
      game.set({ ...fixture, ...('ledger' in fixture ? {} : { ledger: { rows: [t] } }) });
      await look();
      expect((await status()).error).toMatch(why);
      expect((await must(anon().rpc('deposit_info')) as { automatic: boolean }).automatic).toBe(false);
    }
    expect(await gold(h.id)).toBe(0);
    game.set({ ledger: { rows: [t] } });
    await look();
    expect((await status()).error).toBeNull();
    expect((await must(anon().rpc('deposit_info')) as { automatic: boolean }).automatic).toBe(true);
    expect(await gold(h.id)).toBe(10);
  });

  it('a login sealed with another key is reported, not used', async () => {
    await ok(service.from('watcher_state').update({ token_sealed: await seal(LOGIN, 'a-different-key-that-is-32-chars-long!') }).eq('id', 1));
    game.resetHits();
    await look();
    expect((await status()).error).toMatch(/can’t be read/);
    expect(game.hits()['/api/trade/ledger']).toBeUndefined();
    expect((await invoke(org, { action: 'login', token: LOGIN })).status).toBe(200);
    expect((await status()).error).toBeNull();
  });
});

describe('when it looks', () => {
  it('page loads look at most once a minute; the schedule looks at once, with its secret only', async () => {
    const p = await player();
    await ok(service.from('watcher_state').update({ checked_at: null }).eq('id', 1));
    game.resetHits();
    expect((await invoke(p, { action: 'tick' })).body).toMatchObject({ looked: true });
    expect((await invoke(p, { action: 'tick' })).body).toMatchObject({ looked: false });
    expect(game.hits()['/api/trade/ledger']).toBe(1);
    const cron = (secret: string) => fetch(FN, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'cron' }) });
    expect((await cron('wrong-secret-of-some-length')).status).toBe(401);
    expect((await cron('')).status).toBe(401);
    expect((await cron(CRON_SECRET)).status).toBe(200);
    expect(game.hits()['/api/trade/ledger']).toBe(2);
  });

  it('answers the lottery page’s origin, and no other', () => {
    const allowed = ['https://bibo4414.github.io'];
    expect(corsFor('https://bibo4414.github.io', allowed)['Access-Control-Allow-Origin']).toBe('https://bibo4414.github.io');
    expect(corsFor('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBe('https://bibo4414.github.io');
  });
});

describe('turning it off', () => {
  it('forgets the login, and deposits are approved by hand again', async () => {
    expect((await invoke(org, { action: 'stop' })).status).toBe(200);
    expect(await must(service.from('watcher_state').select('token_sealed').eq('id', 1).single())).toEqual({ token_sealed: null });
    expect((await must(anon().rpc('deposit_info')) as { automatic: boolean }).automatic).toBe(false);
    game.resetHits();
    expect((await invoke(org, { action: 'look' })).status).toBe(200);
    expect(game.hits()).toEqual({});
  });
});
