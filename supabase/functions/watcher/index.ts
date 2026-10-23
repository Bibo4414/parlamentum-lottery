// The watcher's door. POST with {"action": ...}:
//   tick                 any signed-in player or organizer (the page sends one on load): looks if a minute has passed
//   cron                 the schedule, with Authorization: Bearer CRON_SECRET: looks now
//   login {token}        the organizer: the House's game login, sealed before it is stored, never sent back
//   look / stop          the organizer: look now / forget the login
// It only reads the game (GETs with the House's login) and never writes to it.
//
// Secrets (supabase secrets set ...): WATCHER_SEAL_KEY (32+ random characters), CRON_SECRET. Optional: GAME_URL,
// ALLOWED_ORIGINS (comma-separated; default https://bibo4414.github.io).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { Off, cleanToken, corsFor, depositContracts, depositListing, game, houseId, loginEnds, marketBuys, sameSecret, seal, unseal, type Terms } from './core.ts';

const env = (name: string) => Deno.env.get(name) ?? '';
const GAME = (env('GAME_URL') || 'https://parlamentum.org').replace(/\/+$/, '');
const ORIGINS = (env('ALLOWED_ORIGINS') || 'https://bibo4414.github.io').split(',').map((o) => o.trim()).filter(Boolean);
const BROKE = 'The watcher hit an unexpected error. See the function logs.';

/** The project's secret key: the newer sb_secret_ key when the project has one, else the older service-role key. */
function serviceKey(): string {
  try {
    const keys: unknown = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    const key = keys && typeof keys === 'object' ? Object.values(keys).find((k) => typeof k === 'string') : undefined;
    if (key) return key;
  } catch { /* the older key below */ }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}
const db = createClient(env('SUPABASE_URL'), serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

const utc = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

interface Claim { token_sealed: string; house_id: string | null; item: string; tier: string | null; price_cents: number; export_tax_pct: number | string }

/** One look at the game, if a minute has passed since the last (or at once, forced). Whatever stops it is kept for the
 *  organizer's panel. Returns whether it looked. */
async function watch(force: boolean): Promise<boolean> {
  const [claim] = await call<Claim[]>('watcher_claim', { p_force: force });
  if (!claim) return false;
  const token = await unseal(claim.token_sealed, env('WATCHER_SEAL_KEY'));
  if (!token) {
    await call('watcher_fail', { p_error: 'The saved game login can’t be read (WATCHER_SEAL_KEY may have changed). Paste it again.' });
    return true;
  }
  const terms: Terms = { item: claim.item, tier: claim.tier, priceCents: claim.price_cents, exportTaxPct: Number(claim.export_tax_pct) };
  try {
    const house = claim.house_id || houseId(await game(GAME, '/api/me', token));
    const [ledger, contracts, listings] = await Promise.all([
      game(GAME, '/api/trade/ledger', token),
      game(GAME, '/api/contracts?box=history', token),
      game(GAME, '/api/global-market/mine', token),
    ]);
    const seen = [...marketBuys(ledger, terms), ...depositContracts(contracts, house, terms)];
    await call('watcher_record', { p_house_id: house, p_sales: seen, p_listing: depositListing(listings, terms) });
  } catch (err) {
    if (!(err instanceof Off)) console.error('watcher:', err instanceof Error ? err.message : 'unknown error');
    await call('watcher_fail', { p_error: err instanceof Off ? err.message : BROKE });
  }
  return true;
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get('origin') ?? '', ORIGINS);
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'POST only.' });

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  try {
    if (action === 'cron') {
      const secret = env('CRON_SECRET');
      if (secret.length < 16 || !sameSecret(bearer, secret)) return reply(401, { error: 'Not the schedule.' });
      return reply(200, { ok: true, looked: await watch(true) });
    }

    const user = bearer ? (await db.auth.getUser(bearer)).data.user : null;
    if (!user) return reply(401, { error: 'Sign in first.' });
    if (action === 'tick') return reply(200, { ok: true, looked: await watch(false) });

    const { data: organizer } = await db.from('lottery_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!organizer) return reply(403, { error: 'Organizer only.' });

    if (action === 'stop') {
      await call('watcher_set_login', { p_sealed: null, p_exp: null });
      return reply(200, { ok: true, message: 'The watcher is off. Deposits are approved by hand again.' });
    }
    if (action === 'look') {
      await watch(true);
      return reply(200, { ok: true, message: 'Looked at the game.' });
    }
    if (action === 'login') {
      const token = cleanToken(body.token);
      const ends = loginEnds(token);
      if (!ends) return reply(400, { error: 'That isn’t a game login. Copy the value of localStorage.token on parlamentum.org.' });
      if (ends.getTime() <= Date.now()) return reply(400, { error: 'That login has already run out. Log in to the game again and copy a fresh one.' });
      const key = env('WATCHER_SEAL_KEY');
      if (key.length < 32) return reply(500, { error: 'WATCHER_SEAL_KEY is not set on the function.' });
      await call('watcher_set_login', { p_sealed: await seal(token, key), p_exp: ends.toISOString() });
      await watch(true);
      return reply(200, { ok: true, message: `The watcher is on until ${utc(ends)}.` });
    }
    return reply(400, { error: 'Unknown action.' });
  } catch (err) {
    console.error('watcher:', err instanceof Error ? err.message : 'unknown error');
    return reply(500, { error: BROKE });
  }
});
