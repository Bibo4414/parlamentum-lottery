// Test accounts and games on the local stack. Every test makes its own players and its own game, so tests don't share
// pools, draws or balances with each other or with the dev seed.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inject } from 'vitest';
import type { Database } from '../src/database.types.ts';

export const stack = inject('stack');
export type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
/** The service role: sets up fixtures and reads the truth behind the API. Never what a page would hold. */
export const service: Client = createClient<Database>(stack.url, stack.secret, options);
export const anon = (): Client => createClient<Database>(stack.url, stack.publishable, options);
export const PASSWORD = 'local-test-password';

let counter = 0;
/** A fresh name that fits the username rule (3–24 letters, digits, _ or -). */
export const unique = (prefix: string) => `${prefix}_${Date.now().toString(36).slice(-5)}${(counter++).toString(36)}`;

const failure = (error: unknown) => (error instanceof Error ? error : new Error(JSON.stringify(error)));
/** The data of a call that must succeed and return something. */
export async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw failure(error);
  if (data === null || data === undefined) throw new Error('The call returned nothing.');
  return data;
}
/** A call that must succeed (a write, or a function that returns nothing). */
export async function ok(p: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await p;
  if (error) throw failure(error);
}

export interface Player { id: string; username: string; email: string; client: Client }

export async function player(gold = 0, username = unique('p')): Promise<Player> {
  const email = `${username.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}@players.lottery.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { username } });
  if (error) throw error;
  // funded through the ledger, like any credit
  if (gold) await must(service.rpc('move_gold', { p_user: data.user.id, p_delta: gold, p_kind: 'credit', p_note: 'test funds' }));
  const client = createClient<Database>(stack.url, stack.publishable, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, username, email, client };
}

export async function organizer(): Promise<Player> {
  const p = await player(0, unique('org'));
  await ok(service.from('lottery_admins').insert({ user_id: p.id }));
  return p;
}

/** A game of its own, with an open draw. */
export async function game(price = 10, seed = 100): Promise<string> {
  const id = unique('g').toLowerCase();
  await ok(service.from('lottery_games').insert({ id, name: id, jackpot: seed, default_jackpot: seed, ticket_price: price }));
  const draw = await must(service.rpc('open_draw', { p_lottery_id: id }));
  await ok(service.from('lottery_games').update({ current_draw_id: draw }).eq('id', id));
  return id;
}

export const gold = async (userId: string) => (await must(service.from('player_profiles').select('gold').eq('user_id', userId).single())).gold;
export const pool = async (gameId: string) => (await must(service.from('lottery_games').select('jackpot').eq('id', gameId).single())).jackpot;
