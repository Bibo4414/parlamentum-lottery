// Fills the LOCAL Supabase stack (npm run db:start) with an organizer, a few players, gold, tickets and one past draw,
// so the page has something to show. Refuses to run against anything but 127.0.0.1 / localhost.
//
//   node scripts/dev-seed.mjs            (after `npm run db:reset`)
//
// Every account's password is DEV_PASSWORD below: these accounts exist only on your own machine.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export const DEV_PASSWORD = 'local-dev-only-password';
export const ORGANIZER = { email: 'organizer@lottery.test', username: 'Bibo4414' };
export const PLAYERS = [
  { username: 'Aurelia', gold: 640 },
  { username: 'Marcus_V', gold: 1250 },
  { username: 'Tiberius', gold: 85 },
  { username: 'Livia Drusa', gold: 300 },
];

/** The page's own username → sign-in address rule (index.html usernameAlias). */
export function usernameAlias(username) {
  let hash = 2166136261;
  for (const ch of username.toLowerCase()) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  const slug = username.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 24);
  return `${slug}.${hash.toString(36)}@players.parlamentum.invalid`;
}

export function localStack() {
  const status = JSON.parse(execSync('npx -y supabase@2.119.0 status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  const url = status.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw new Error(`Not a local stack: ${url}`);
  return { url, publishable: status.PUBLISHABLE_KEY, secret: status.SECRET_KEY };
}

async function main() {
  const { url, publishable, secret } = localStack();
  const admin = createClient(url, secret, { auth: { persistSession: false } });

  async function user(email, username) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: DEV_PASSWORD, email_confirm: true, user_metadata: { username } });
    if (error) throw new Error(`${username}: ${error.message}`);
    return data.user.id;
  }
  async function as(email) {
    const c = createClient(url, publishable, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: DEV_PASSWORD });
    if (error) throw error;
    return c;
  }
  const rpc = async (c, fn, args) => { const { data, error } = await c.rpc(fn, args); if (error) throw new Error(`${fn}: ${error.message}`); return data; };

  const organizerId = await user(ORGANIZER.email, ORGANIZER.username);
  { const { error } = await admin.from('lottery_admins').insert({ user_id: organizerId }); if (error) throw error; }
  const organizer = await as(ORGANIZER.email);

  for (const p of PLAYERS) {
    p.email = usernameAlias(p.username);
    p.id = await user(p.email, p.username);
    await rpc(organizer, 'admin_credit_gold', { p_username: p.username, p_amount: p.gold + 400 });
    p.client = await as(p.email);
  }
  const [aurelia, marcus, tiberius, livia] = PLAYERS;

  // one finished Grand draw for the history (the draw opens the next one by itself)
  await rpc(aurelia.client, 'buy_lottery_tickets', { p_quantity: 2, p_lottery_id: 'grand' });
  await rpc(marcus.client, 'buy_lottery_tickets', { p_quantity: 3, p_lottery_id: 'grand' });
  await rpc(organizer, 'admin_close_and_draw', { p_lottery_id: 'grand' });

  // the current draws
  await rpc(aurelia.client, 'buy_lottery_tickets', { p_quantity: 3, p_lottery_id: 'mini' });
  await rpc(marcus.client, 'buy_lottery_tickets', { p_quantity: 5, p_lottery_id: 'mini' });
  await rpc(tiberius.client, 'buy_lottery_tickets', { p_quantity: 1, p_lottery_id: 'mini' });
  await rpc(marcus.client, 'buy_lottery_tickets', { p_quantity: 2, p_lottery_id: 'grand' });
  await rpc(livia.client, 'buy_lottery_tickets', { p_quantity: 1, p_lottery_id: 'grand' });
  await rpc(organizer, 'admin_set_draw_time', { p_lottery_id: 'mini', p_draw_at: new Date(Date.now() + 2 * 86_400_000 + 5 * 3_600_000).toISOString() });

  // a withdrawal waiting for the organizer
  await rpc(livia.client, 'request_lottery_withdrawal', { p_amount: 150 });

  // a deposit a player announced, waiting for the organizer
  await rpc(tiberius.client, 'request_lottery_deposit', { p_amount: 40 });

  // back to the advertised balances
  for (const p of PLAYERS) {
    const { data } = await admin.from('player_profiles').select('gold').eq('user_id', p.id).single();
    console.log(`${p.username.padEnd(12)} ${String(data.gold).padStart(6)} gold   sign in as "${p.username}"`);
  }
  console.log(`${ORGANIZER.username.padEnd(12)} organizer  sign in as "${ORGANIZER.username}" with e-mail ${ORGANIZER.email}`);
  console.log(`password for every local account: see DEV_PASSWORD in scripts/dev-seed.mjs`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((err) => { console.error(err.message ?? err); process.exit(1); });
