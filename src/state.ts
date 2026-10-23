// What the page knows, in one place. data.ts fills it; the views only read it.
import type { Session } from '@supabase/supabase-js';
import type { Tables } from './database.types.ts';

export type LotteryId = 'mini' | 'grand';
export const LOTTERIES: LotteryId[] = ['mini', 'grand'];
export const LOTTERY_NAMES: Record<LotteryId, string> = { mini: 'Mini', grand: 'Grand' };
export const isLotteryId = (id: string | null | undefined): id is LotteryId => id === 'mini' || id === 'grand';

export type Game = Pick<Tables<'lottery_games'>, 'id' | 'name' | 'jackpot' | 'default_jackpot' | 'ticket_price' | 'sales_open' | 'draw_at' | 'current_draw_id'> & { seed_hash: string | null };
export type Winner = Pick<Tables<'draw_history'>, 'id' | 'lottery_id' | 'draw_id' | 'winner_username' | 'ticket_number' | 'prize_gold' | 'drawn_at'>;
export type MyTicket = Pick<Tables<'lottery_tickets'>, 'id' | 'ticket_number' | 'draw_id' | 'lottery_id'>;
export type Move = Pick<Tables<'gold_moves'>, 'id' | 'delta' | 'kind' | 'ref' | 'note' | 'created_at'>;
export type Request = Pick<Tables<'withdrawal_requests'>, 'id' | 'amount' | 'status' | 'created_at'>;
export type Named<T> = T & { username: string };

/** The deposit terms (deposit_info): what to buy, from whom, at what price; whether deposits land by themselves. */
export interface DepositInfo { house_name: string; item: string; item_label: string; tier: string | null; price_cents: number; export_tax_pct: number; import_tax_pct: number; automatic: boolean }
export interface WatchSale { id: string; kind: 'market' | 'contract'; at: string; units: number | null; gross_cents: number; tax_cents: number; gold: number; name: string; state: 'open' | 'deposit' | 'other'; reason: string | null }
/** The organizer's view of the watcher (admin_watcher_status): never the login itself. */
export interface WatchView { on: boolean; error: string | null; ok_at: string | null; login_ends: string | null; since: string | null; listing: { remaining: number; endsAt: string } | null; sales: WatchSale[] }
export interface HouseNumbers { balances: number; pending_withdrawals: number; ticket_gold: number; seed_gold: number; owed_to_players: number; fees: number; mismatches: number }
export interface DrawStat { lottery_id: string; draw_id: number; tickets: number; players: number; fees: number }

export interface Me { userId: string; username: string; gold: number; organizer: boolean }

export interface Organizer {
  deposits: Named<Request>[];
  withdrawals: Named<Request>[];
  watch: WatchView | null;
  house: HouseNumbers | null;
  stats: DrawStat[];
}

export const state = {
  loaded: false,
  offline: false,
  session: null as Session | null,
  me: null as Me | null,
  games: { mini: null, grand: null } as Record<LotteryId, Game | null>,
  winners: [] as Winner[],
  terms: null as DepositInfo | null,
  myTickets: [] as MyTicket[],
  myMoves: [] as Move[],
  myDeposits: [] as Request[],
  myWithdrawals: [] as Request[],
  organizer: null as Organizer | null,
};
