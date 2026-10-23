// Loading what the page shows, and every action a player or the organizer can take. The database checks everything;
// these calls only carry the request and bring back its answer in plain words.
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase.ts';
import { verifyDraw, type Entry, type Verdict } from './lib/verify.ts';
import {
  LOTTERIES, state, type DepositInfo, type DrawStat, type Game, type HouseNumbers, type LotteryId, type Named, type Organizer, type Request,
  type WatchView,
} from './state.ts';

export type Result = { ok: true; message: string } | { ok: false; message: string };
const SORRY = 'That didn’t go through. Check your connection and try again.';
/** The database answers in plain sentences; anything technical (a dropped connection, an expired session, a
 *  PostgREST code) becomes a sentence a player can act on. */
function messageOf(error: unknown): string {
  const text = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '';
  if (/jwt|token|refresh/i.test(text)) return 'Your session has run out. Sign in again.';
  if (!text || /fetch|network|PGRST|schema cache|permission denied|violates|syntax|function .*does not exist/i.test(text)) return SORRY;
  return text;
}

async function run(call: PromiseLike<{ error: unknown }>, done: string): Promise<Result> {
  try {
    const { error } = await call;
    return error ? { ok: false, message: messageOf(error) } : { ok: true, message: done };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

// ---------- loading ----------

/** Everything the current screen needs: public data for everyone, the player's own when signed in, the organizer's
 *  tools for the organizer. */
export async function load(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  state.session = session;
  const [games, winners, terms] = await Promise.all([
    supabase.from('lottery_games').select('id,name,jackpot,default_jackpot,ticket_price,sales_open,draw_at,current_draw_id'),
    supabase.from('draw_history').select('id,lottery_id,draw_id,winner_username,ticket_number,prize_gold,drawn_at').order('drawn_at', { ascending: false }).limit(20),
    supabase.rpc('deposit_info'),
  ]);
  state.offline = !!games.error;
  if (games.error) return;
  const drawIds = (games.data ?? []).map((g) => g.current_draw_id).filter((id): id is number => id !== null);
  const seals = drawIds.length ? await supabase.from('lottery_draws').select('id,seed_hash').in('id', drawIds) : { data: [] };
  for (const id of LOTTERIES) {
    const g = games.data?.find((x) => x.id === id);
    state.games[id] = g ? { ...g, seed_hash: seals.data?.find((d) => d.id === g.current_draw_id)?.seed_hash ?? null } satisfies Game : null;
  }
  state.winners = winners.data ?? [];
  state.terms = (terms.data as DepositInfo | null) ?? null;
  if (session) await loadMine(session, drawIds);
  else Object.assign(state, { me: null, myTickets: [], myMoves: [], myDeposits: [], myWithdrawals: [], organizer: null });
  state.loaded = true;
}

async function loadMine(session: Session, drawIds: number[]) {
  const uid = session.user.id;
  const [profile, organizer, tickets, moves, deposits, withdrawals] = await Promise.all([
    supabase.from('player_profiles').select('username,gold').eq('user_id', uid).maybeSingle(),
    supabase.rpc('is_lottery_admin'),
    supabase.from('lottery_tickets').select('id,ticket_number,draw_id,lottery_id').eq('user_id', uid).in('draw_id', drawIds.length ? drawIds : [-1]).order('ticket_number'),
    supabase.from('gold_moves').select('id,delta,kind,ref,note,created_at').eq('user_id', uid).order('id', { ascending: false }).limit(40),
    supabase.from('deposit_requests').select('id,amount,status,created_at').eq('user_id', uid).eq('status', 'pending').order('created_at'),
    supabase.from('withdrawal_requests').select('id,amount,status,created_at').eq('user_id', uid).eq('status', 'pending').order('created_at'),
  ]);
  state.me = profile.data ? { userId: uid, username: profile.data.username, gold: profile.data.gold, organizer: organizer.data === true } : null;
  state.myTickets = tickets.data ?? [];
  state.myMoves = moves.data ?? [];
  state.myDeposits = deposits.data ?? [];
  state.myWithdrawals = withdrawals.data ?? [];
  state.organizer = state.me?.organizer ? await loadOrganizer() : null;
}

async function loadOrganizer(): Promise<Organizer> {
  const [deposits, withdrawals, watch, house, stats] = await Promise.all([
    supabase.from('deposit_requests').select('id,amount,status,created_at,user_id').eq('status', 'pending').order('created_at'),
    supabase.from('withdrawal_requests').select('id,amount,status,created_at,user_id').eq('status', 'pending').order('created_at'),
    supabase.rpc('admin_watcher_status'),
    supabase.rpc('admin_house_numbers'),
    supabase.rpc('admin_draw_stats'),
  ]);
  const rows = [...(deposits.data ?? []), ...(withdrawals.data ?? [])];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const profiles = ids.length ? await supabase.from('player_profiles').select('user_id,username').in('user_id', ids) : { data: [] };
  const named = <T extends Request & { user_id: string }>(list: T[] | null): Named<Request>[] =>
    (list ?? []).map(({ user_id, ...r }) => ({ ...r, username: profiles.data?.find((p) => p.user_id === user_id)?.username ?? 'a player' }));
  return {
    deposits: named(deposits.data),
    withdrawals: named(withdrawals.data),
    watch: (watch.data as WatchView | null) ?? null,
    house: ((house.data as HouseNumbers[] | null) ?? [])[0] ?? null,
    stats: (stats.data as DrawStat[] | null) ?? [],
  };
}

// ---------- accounts ----------

/** Supabase accounts need an e-mail; a player who signs up with their name alone gets this made-up address, the same
 *  one every time for the same name. (Unchanged from the original page, so existing accounts keep working.) */
function usernameAlias(username: string) {
  let hash = 2166136261;
  for (const ch of username.toLowerCase()) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  const slug = username.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 24);
  return `${slug}.${hash.toString(36)}@players.parlamentum.invalid`;
}
const NAME = /^[A-Za-z0-9_ -]{3,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(name: string, password: string, email: string): Promise<Result> {
  if (!name.trim() && !email.trim()) return { ok: false, message: 'Enter your Parlamentum name.' };
  if (!password) return { ok: false, message: 'Enter your password.' };
  if (email && !EMAIL.test(email)) return { ok: false, message: 'That e-mail address doesn’t look right.' };
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim() || usernameAlias(name.trim()), password });
  return error ? { ok: false, message: 'That name and password don’t match an account.' } : { ok: true, message: 'Signed in.' };
}

export async function signUp(name: string, password: string, email: string): Promise<Result> {
  const username = name.trim();
  if (!NAME.test(username)) return { ok: false, message: 'Your Parlamentum name: 3 to 24 letters, digits, spaces, _ or -.' };
  if (password.length < 8) return { ok: false, message: 'The password needs at least 8 characters.' };
  if (email && !EMAIL.test(email)) return { ok: false, message: 'That e-mail address doesn’t look right.' };
  const { data, error } = await supabase.auth.signUp({ email: email.trim() || usernameAlias(username), password, options: { data: { username } } });
  if (error) return { ok: false, message: /already|exists|taken|database/i.test(error.message) ? 'That name already has an account. Sign in instead.' : messageOf(error) };
  return { ok: true, message: data.session ? `Welcome, ${username}.` : 'Account created. Sign in to continue.' };
}

export const signOut = () => run(supabase.auth.signOut(), 'Signed out.');

// ---------- players ----------

export const buy = (lottery: LotteryId, quantity: number) =>
  run(supabase.rpc('buy_lottery_tickets', { p_quantity: quantity, p_lottery_id: lottery }), `${quantity === 1 ? 'Ticket' : `${quantity} tickets`} bought. Good luck.`);
export const requestDeposit = (amount: number) =>
  run(supabase.rpc('request_lottery_deposit', { p_amount: amount }), 'Deposit reported. It is credited as soon as the trade is seen.');
export const requestWithdrawal = (amount: number) =>
  run(supabase.rpc('request_lottery_withdrawal', { p_amount: amount }), 'Withdrawal requested. Your gold is held until it is paid.');

/** The cost of `quantity` tickets: the prices plus the organizer's 10%, rounded up per purchase, as the database counts. */
export function cost(price: number, quantity: number) {
  const tickets = price * quantity, fee = Math.ceil(tickets / 10);
  return { tickets, fee, total: tickets + fee };
}

/** A finished draw re-done in this browser: what the check found, the fingerprint shown before, the seed after. */
export interface DrawCheck { verdict: Verdict; seed: string | null; seedHash: string | null }

/** Re-does finished draws from what was published: one read for the draws, then each draw's ticket list, a few at a
 *  time. A draw that couldn't be loaded maps to null. */
export async function checkDraws(ids: number[]): Promise<Map<number, DrawCheck | null>> {
  const out = new Map<number, DrawCheck | null>();
  const draws = await supabase.from('lottery_draws').select('id,seed_hash,seed,tickets_digest,ticket_count,winning_index,winning_ticket').in('id', ids);
  if (draws.error) { ids.forEach((id) => out.set(id, null)); return out; }
  const one = async (id: number) => {
    const draw = draws.data.find((d) => d.id === id);
    if (!draw) return out.set(id, null);
    if (!draw.seed) return out.set(id, { verdict: await verifyDraw(draw, []), seed: null, seedHash: draw.seed_hash });
    const entries = await supabase.rpc('draw_tickets', { p_draw_id: id });
    return out.set(id, entries.error ? null : { verdict: await verifyDraw(draw, (entries.data ?? []) as Entry[]), seed: draw.seed, seedHash: draw.seed_hash });
  };
  for (let i = 0; i < ids.length; i += 5) await Promise.all(ids.slice(i, i + 5).map(one));
  return out;
}

// ---------- the organizer ----------

export const credit = (name: string, amount: number) => run(supabase.rpc('admin_credit_gold', { p_username: name, p_amount: amount }), `${amount} gold added to ${name}.`);
export async function settleDeposit(id: number, approve: boolean, force = false): Promise<Result & { askFirst?: string }> {
  const { error } = await supabase.rpc('admin_process_deposit', { p_request_id: id, p_approve: approve, p_force: force });
  if (error?.message.startsWith('NO_TRADE: ')) return { ok: false, message: error.message, askFirst: error.message.slice('NO_TRADE: '.length) };
  return error ? { ok: false, message: messageOf(error) } : { ok: true, message: approve ? 'Deposit credited.' : 'Deposit request rejected.' };
}
export const settleWithdrawal = (id: number, paid: boolean) =>
  run(supabase.rpc('admin_process_withdrawal', { p_request_id: id, p_approve: paid }), paid ? 'Withdrawal marked paid.' : 'Withdrawal rejected; the gold went back to the player.');
export const setPrice = (lottery: LotteryId, price: number) => run(supabase.rpc('admin_set_ticket_price', { p_ticket_price: price, p_lottery_id: lottery }), 'Ticket price saved.');
export const setPool = (lottery: LotteryId, amount: number) => run(supabase.rpc('admin_set_jackpot', { p_amount: amount, p_lottery_id: lottery }), 'Pool set.');
export const poolToTickets = (lottery: LotteryId) => run(supabase.rpc('admin_reset_jackpot_to_ticket_total', { p_lottery_id: lottery }), 'The pool is now the ticket money alone.');
export const setSales = (lottery: LotteryId, open: boolean) => run(supabase.rpc('admin_set_sales_open', { p_open: open, p_lottery_id: lottery }), open ? 'Ticket sales are open.' : 'Ticket sales are closed.');
export const setDrawTime = (lottery: LotteryId, iso: string | null) =>
  // null clears the time; the generated types don't mark function arguments as nullable
  run(supabase.rpc('admin_set_draw_time', { p_lottery_id: lottery, p_draw_at: iso as string }), iso ? 'Draw time announced.' : 'Draw time cleared.');
export const draw = (lottery: LotteryId) => run(supabase.rpc('admin_close_and_draw', { p_lottery_id: lottery }), 'Drawn. The winner has been paid and a new draw is open.');
export const reopen = (lottery: LotteryId) => run(supabase.rpc('admin_reopen_draw', { p_lottery_id: lottery }), 'A fresh draw is open.');
export const cancelAllTickets = () => run(supabase.rpc('admin_delete_all_lottery_tickets'), 'Every open ticket was cancelled and refunded.');
export const restartDraws = () => run(supabase.rpc('admin_reset_lottery_data'), 'Both draws restarted; tickets refunded, past winners kept.');
export const setTerms = (t: { house: string; item: string; label: string; tier: string; priceCents: number; exportTax: number; importTax: number }) =>
  run(supabase.rpc('admin_set_deposit_terms', {
    p_house_name: t.house, p_item: t.item, p_item_label: t.label, p_tier: t.tier, p_price_cents: t.priceCents, p_export_tax_pct: t.exportTax, p_import_tax_pct: t.importTax,
  }), 'Deposit terms saved.');

/** The watcher's edge function, called with the signed-in session. */
export async function watcher(action: 'tick' | 'login' | 'look' | 'stop', extra: Record<string, unknown> = {}): Promise<Result & { looked?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('watcher', { body: { action, ...extra } });
    if (!error) return { ok: true, message: (data as { message?: string })?.message ?? 'Done.', looked: (data as { looked?: boolean })?.looked === true };
    const res = (error as { context?: Response }).context;
    const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
    return { ok: false, message: body.error || 'The watcher couldn’t be reached.' };
  } catch {
    return { ok: false, message: 'The watcher couldn’t be reached.' };
  }
}
