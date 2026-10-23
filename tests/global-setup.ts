// Finds the local Supabase stack once and hands its address and keys to the tests. Refuses anything that isn't local.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import type { TestProject } from 'vitest/node';

export interface Stack { url: string; publishable: string; secret: string; functions: string }
declare module 'vitest' {
  export interface ProvidedContext { stack: Stack }
}

export default async function setup(project: TestProject) {
  let status: Record<string, string>;
  try {
    status = JSON.parse(execSync('npx -y supabase@2.119.0 status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch {
    throw new Error('The local Supabase stack is not running. Start it with `npm run db:start` (Docker must be running).');
  }
  const url = status.API_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw new Error(`Tests only run against a local stack, not ${url}`);
  const secret = status.SECRET_KEY ?? '';
  // `npm run dev:watcher` leaves the watcher on for a day, and while it is on, crediting a deposit by hand waits for the
  // game's trade; every run starts with it off, whichever test file happens to go first
  const service = createClient(url, secret, { auth: { persistSession: false } });
  const off = await service.from('watcher_state')
    .update({ token_sealed: null, token_exp: null, since: null, house_id: null, checked_at: null, ok_at: null, error: null, listing: null })
    .eq('id', 1);
  if (off.error) throw new Error(`Couldn't reset the watcher before the tests: ${off.error.message}`);
  project.provide('stack', { url, publishable: status.PUBLISHABLE_KEY ?? '', secret, functions: status.FUNCTIONS_URL ?? '' });
}
