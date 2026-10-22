// The security pass: the gold ledger, refunds instead of lost gold, the pool floor, the limits, and draws anyone can
// check. Each test states what must hold and checks it through the same API the page uses.
import { describe, expect, it } from 'vitest';
import { verifyDraw, winningIndex, type DrawRecord } from '../src/lib/verify.ts';
import { anon, game, gold, must, ok, organizer, player, pool, service } from './helpers.ts';

const ledgerSum = async (userId: string) =>
  (await must(service.from('gold_moves').select('delta').eq('user_id', userId))).reduce((t, m) => t + m.delta, 0);
const currentDraw = async (gameId: string) => (await must(service.from('lottery_games').select('current_draw_id').eq('id', gameId).single())).current_draw_id!;
/** Fees of every purchase still in an open draw: what "delete all tickets" hands back. */
const openFees = async () => {
  const draws = (await must(service.from('lottery_games').select('current_draw_id'))).map((g) => g.current_draw_id!);
  return (await must(service.from('ticket_purchases').select('fee').in('draw_id', draws).is('refunded_at', null))).reduce((t, p) => t + p.fee, 0);
};
const drawRecord = async (drawId: number): Promise<DrawRecord> =>
  must(anon().from('lottery_draws').select('id,seed_hash,seed,tickets_digest,ticket_count,winning_index,winning_ticket').eq('id', drawId).single());

describe('the gold ledger', () => {
  it('every change to a balance writes a line, so the ledger always adds up to the balance', async () => {
    const org = await organizer();
    const g = await game(10, 50);
    const p = await player();
    await must(org.client.rpc('admin_credit_gold', { p_username: p.username, p_amount: 300 }));
    await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 2, p_lottery_id: g }));
    const w1 = await must(p.client.rpc('request_lottery_withdrawal', { p_amount: 40 }));
    await ok(org.client.rpc('admin_process_withdrawal', { p_request_id: w1, p_approve: false }));
    const d1 = await must(p.client.rpc('request_lottery_deposit', { p_amount: 25 }));
    await ok(org.client.rpc('admin_process_deposit', { p_request_id: d1, p_approve: true }));
    await must(org.client.rpc('admin_close_and_draw', { p_lottery_id: g }));

    const moves = await must(p.client.from('gold_moves').select('kind,delta,actor').order('id'));
    expect(moves.map((m) => [m.kind, m.delta])).toEqual([
      ['credit', 300], ['tickets', -22], ['withdrawal', -40], ['withdrawal_refund', 40], ['deposit', 25], ['prize', 70],
    ]);
    expect(moves[0]!.actor).toBe(org.id); // a credit by hand names who gave it
    expect(await ledgerSum(p.id)).toBe(await gold(p.id));
    expect((await must(org.client.rpc('gold_mismatches'))).filter((m) => m.username === p.username)).toEqual([]);
  });

  it('a balance changed outside the functions shows up as a mismatch', async () => {
    const org = await organizer();
    const p = await player();
    await must(org.client.rpc('admin_credit_gold', { p_username: p.username, p_amount: 10 }));
    await ok(service.from('player_profiles').update({ gold: 500 }).eq('user_id', p.id)); // e.g. an edit in the dashboard
    expect(await must(org.client.rpc('gold_mismatches'))).toContainEqual({ username: p.username, gold: 500, ledger: 10 });
    await ok(service.from('player_profiles').update({ gold: 10 }).eq('user_id', p.id));
  });

  it('players read only their own lines, and the mismatch list is the organizer’s', async () => {
    const a = await player(), b = await player();
    const org = await organizer();
    await must(org.client.rpc('admin_credit_gold', { p_username: b.username, p_amount: 5 }));
    expect(await must(a.client.from('gold_moves').select('id').eq('user_id', b.id))).toEqual([]);
    expect((await a.client.rpc('gold_mismatches')).error).toBeTruthy();
    expect((await a.client.rpc('move_gold', { p_user: a.id, p_delta: 100, p_kind: 'credit' })).error).toBeTruthy();
    expect(await gold(a.id)).toBe(0);
  });
});

describe('cancelling tickets refunds them', () => {
  it('"delete all tickets" gives back price and fee, empties the pools of ticket money, and keeps the winners', async () => {
    const org = await organizer();
    const g = await game(15, 100);
    const a = await player(500), b = await player(500);
    await must(a.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g })); // 15 + 2
    await must(b.client.rpc('buy_lottery_tickets', { p_quantity: 3, p_lottery_id: g })); // 45 + 5
    const winnersBefore = (await must(anon().from('draw_history').select('id'))).length;
    const feesBefore = await must(org.client.rpc('admin_get_fee_earnings'));
    const refundable = await openFees();
    expect(refundable).toBeGreaterThanOrEqual(7);
    await must(org.client.rpc('admin_delete_all_lottery_tickets'));
    expect([await gold(a.id), await gold(b.id)]).toEqual([500, 500]);
    expect(await pool(g)).toBe(100);
    expect(await must(org.client.rpc('admin_get_fee_earnings'))).toBe(feesBefore - refundable);
    expect((await must(anon().from('draw_history').select('id'))).length).toBe(winnersBefore);
  });

  it('"reset" refunds the open draw and starts a fresh one at the seed, and past winners stay', async () => {
    const org = await organizer();
    const g = await game(10, 40);
    const p = await player(200);
    await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 2, p_lottery_id: g }));
    await must(org.client.rpc('admin_close_and_draw', { p_lottery_id: g })); // a winner on record
    await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 5, p_lottery_id: g }));
    const before = await currentDraw(g);
    await ok(org.client.rpc('admin_reset_lottery_data'));
    expect(await gold(p.id)).toBe(200 - 22 + 60); // the second purchase came back; the prize from the first draw stays
    expect(await currentDraw(g)).not.toBe(before);
    expect(await pool(g)).toBe(40);
    expect(await must(anon().from('draw_history').select('lottery_id').eq('lottery_id', g))).toHaveLength(1);
  });

  it('"reopen" won’t leave an open draw’s tickets behind', async () => {
    const org = await organizer();
    const g = await game();
    const p = await player(100);
    await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g }));
    expect((await org.client.rpc('admin_reopen_draw', { p_lottery_id: g })).error?.message).toMatch(/has tickets/);
  });
});

describe('limits', () => {
  it('the pool can’t be set below the ticket money players paid into it', async () => {
    const org = await organizer();
    const g = await game(10, 100);
    const p = await player(500);
    await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 4, p_lottery_id: g }));
    expect((await org.client.rpc('admin_set_jackpot', { p_amount: 39, p_lottery_id: g })).error?.message).toMatch(/paid 40 gold/);
    await ok(org.client.rpc('admin_set_jackpot', { p_amount: 40, p_lottery_id: g }));
    await ok(org.client.rpc('admin_set_jackpot', { p_amount: 1000, p_lottery_id: g }));
    expect(await pool(g)).toBe(1000);
  });

  it('three withdrawals may wait at once, even when asked for in parallel', async () => {
    const p = await player(1000);
    const results = await Promise.all(Array.from({ length: 6 }, () => p.client.rpc('request_lottery_withdrawal', { p_amount: 10 })));
    expect(results.filter((r) => !r.error)).toHaveLength(3);
    expect(await gold(p.id)).toBe(970);
  });

  it('organizer accounts can’t buy tickets', async () => {
    const org = await organizer();
    const g = await game();
    await must(org.client.rpc('admin_credit_gold', { p_username: org.username, p_amount: 100 }));
    expect((await org.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g })).error?.message).toMatch(/Organizer accounts/);
  });

  it('a draw announced for later can’t happen early, unless the time is cleared first', async () => {
    const org = await organizer();
    const g = await game();
    const p = await player(100);
    await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g }));
    await ok(org.client.rpc('admin_set_draw_time', { p_lottery_id: g, p_draw_at: new Date(Date.now() + 3_600_000).toISOString() }));
    expect((await org.client.rpc('admin_close_and_draw', { p_lottery_id: g })).error?.message).toMatch(/announced for/);
    await ok(org.client.rpc('admin_set_draw_time', { p_lottery_id: g, p_draw_at: null as unknown as string }));
    await must(org.client.rpc('admin_close_and_draw', { p_lottery_id: g }));
  });
});

describe('draws anyone can check', () => {
  it('only the seed’s fingerprint is public while tickets sell; the seed and ticket list come out with the result', async () => {
    const org = await organizer();
    const g = await game(10, 0);
    const players = await Promise.all([player(500), player(500), player(500)]);
    for (const [i, p] of players.entries()) await must(p.client.rpc('buy_lottery_tickets', { p_quantity: i + 1, p_lottery_id: g }));
    const drawId = await currentDraw(g);

    const open = await drawRecord(drawId);
    expect(open.seed_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(open.seed).toBeNull();
    expect((await players[0]!.client.from('lottery_draw_secrets').select('*')).data ?? []).toEqual([]);
    expect(await must(anon().rpc('draw_tickets', { p_draw_id: drawId }))).toEqual([]);

    const [won] = await must(org.client.rpc('admin_close_and_draw', { p_lottery_id: g }));
    const done = await drawRecord(drawId);
    expect(done.seed_hash).toBe(open.seed_hash);
    const entries = await must(anon().rpc('draw_tickets', { p_draw_id: drawId }));
    expect(entries).toHaveLength(6);
    const verdict = await verifyDraw(done, entries);
    expect(verdict.checks.filter((c) => !c.ok)).toEqual([]);
    expect(verdict).toMatchObject({ ok: true, ticket: won!.ticket_number, winner: won!.winner_username });
  });

  it('a swapped seed or an edited ticket list fails the check', async () => {
    const org = await organizer();
    const g = await game(10, 0);
    const a = await player(500), b = await player(500);
    await must(a.client.rpc('buy_lottery_tickets', { p_quantity: 2, p_lottery_id: g }));
    await must(b.client.rpc('buy_lottery_tickets', { p_quantity: 2, p_lottery_id: g }));
    const drawId = await currentDraw(g);
    await must(org.client.rpc('admin_close_and_draw', { p_lottery_id: g }));
    const done = await drawRecord(drawId);
    const entries = await must(anon().rpc('draw_tickets', { p_draw_id: drawId }));
    expect((await verifyDraw({ ...done, seed: 'f'.repeat(64) }, entries)).ok).toBe(false);
    expect((await verifyDraw(done, entries.map((e) => (e.ticket_number === 1 ? { ...e, username: b.username === e.username ? a.username : b.username } : e)))).ok).toBe(false);
    expect((await verifyDraw(done, entries.slice(1))).ok).toBe(false);
  });

  it('the pick spreads evenly over the tickets', async () => {
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < 7000; i++) counts[await winningIndex(i.toString(16).padStart(64, '0'), 1, 'digest', 7)]! += 1;
    for (const c of counts) expect(Math.abs(c - 1000)).toBeLessThan(130); // about four standard deviations
  });
});
