// The watcher on your own machine: a mock of the game with a few trades by the seeded players, the real edge function
// (supabase functions serve) with made-up secrets, and the watcher turned on as the local organizer. Ctrl-C stops it.
// Needs the local stack and its seed (npm run db:start, npm run db:seed). Never talks to the real game.
//
//   npm run dev:watcher
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { contract, fakeLogin, mockGame, sale } from '../tests/mock-game.ts';
import { DEV_PASSWORD, ORGANIZER, localStack } from './dev-seed.mjs';

const PORT = 3299;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { url, publishable } = localStack();

const game = mockGame(PORT);
await game.start();
const listings = [{ itemType: 'COPPER_RAW', tier: null, pricePerUnit: '112', remaining: '160', expiresAt: new Date(Date.now() + 9 * 3_600_000).toISOString() }];
game.set({ ledger: { rows: [] }, contracts: [], listings });

const envFile = join(mkdtempSync(join(tmpdir(), 'lottery-watcher-')), 'env');
writeFileSync(envFile, [
  `WATCHER_SEAL_KEY=${randomBytes(36).toString('base64url')}`,
  `CRON_SECRET=${randomBytes(24).toString('base64url')}`,
  `GAME_URL=http://host.docker.internal:${PORT}`,
  'ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173',
].join('\n') + '\n');
const serve = spawn('npx', ['-y', 'supabase@2.119.0', 'functions', 'serve', '--env-file', envFile], { stdio: 'inherit' });
const stop = () => { serve.kill('SIGTERM'); game.stop().finally(() => process.exit(0)); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

for (let i = 0; i < 90; i++) {
  try { if ((await fetch(`${url}/functions/v1/watcher`, { method: 'OPTIONS' })).status === 204) break; } catch { /* not up yet */ }
  await sleep(1000);
}

// the watcher starts first: trades from before it started are the organizer's to credit by hand
const organizer = createClient(url, publishable, { auth: { persistSession: false } });
const { error } = await organizer.auth.signInWithPassword({ email: ORGANIZER.email, password: DEV_PASSWORD });
if (error) throw error;
await organizer.rpc('admin_set_deposit_terms', { p_house_name: ORGANIZER.username, p_item: 'COPPER_RAW', p_item_label: 'Raw Copper', p_tier: '', p_price_cents: 112, p_export_tax_pct: 10, p_import_tax_pct: 10 });
const on = await organizer.functions.invoke('watcher', { body: { action: 'login', token: fakeLogin(1.5) } });
if (on.error) throw on.error;
// trades made after the watcher started: three purchases at the deposit price, one at a wrong price, one contract
await sleep(1500);
game.set({
  ledger: { rows: [sale('Aurelia', 120, 112, 10), sale('Marcus_V', 40, 112, 10), sale('Quintus', 15, 112, 10), sale('Livia Drusa', 25, 105, 10)] },
  contracts: [contract('Tiberius', 50000)],
  listings,
});
await organizer.functions.invoke('watcher', { body: { action: 'look' } });
console.log('\nThe watcher is on, reading the mock game on port', PORT, '- open the organizer panel. Ctrl-C to stop.');
