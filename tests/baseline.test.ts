// The contract the page relies on: what each database function does with gold, tickets and draws, and who may read
// or write what. Runs against the local stack with its own players and games.
import { describe, expect, it } from 'vitest';
import { anon, game, gold, must, ok, organizer, player, pool, service, unique } from './helpers.ts';

describe('accounts', () => {
  it('a sign-up becomes a player with that username and no gold', async () => {
    const p = await player();
    const row = await must(p.client.from('player_profiles').select('username,gold').eq('user_id', p.id).single());
    expect(row).toEqual({ username: p.username, gold: 0 });
  });

  it('refuses a username outside the rule, and one that differs from a taken one only in case', async () => {
    const bad = await service.auth.admin.createUser({ email: `${unique('x')}@players.lottery.test`, password: 'local-test-password', user_metadata: { username: 'no<html>' } });
    expect(bad.error).toBeTruthy();
    const taken = await player();
    const twin = await service.auth.admin.createUser({ email: `${unique('x')}@players.lottery.test`, password: 'local-test-password', user_metadata: { username: taken.username.toUpperCase() } });
    expect(twin.error).toBeTruthy();
  });
});

describe('buying tickets', () => {
  it('takes price × quantity plus a 10% fee rounded up, numbers tickets from 1, and grows the pool by the price', async () => {
    const g = await game(15, 100);
    const p = await player(1000);
    const first = await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g }));
    expect(first.map((t) => t.ticket_number)).toEqual([1]);
    expect(await gold(p.id)).toBe(1000 - 15 - 2); // ceil(1.5) = 2
    const more = await must(p.client.rpc('buy_lottery_tickets', { p_quantity: 3, p_lottery_id: g }));
    expect(more.map((t) => t.ticket_number)).toEqual([2, 3, 4]);
    expect(await gold(p.id)).toBe(1000 - 17 - 45 - 5); // ceil(4.5) = 5
    expect(await pool(g)).toBe(100 + 60);
  });

  it('refuses without enough gold, outside 1–10 tickets, with sales closed, after the draw time, or logged out', async () => {
    const g = await game(10, 100);
    const p = await player(10);
    expect((await p.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g })).error?.message).toMatch(/Not enough gold/);
    await ok(service.from('player_profiles').update({ gold: 500 }).eq('user_id', p.id));
    expect((await p.client.rpc('buy_lottery_tickets', { p_quantity: 11, p_lottery_id: g })).error).toBeTruthy();
    expect((await p.client.rpc('buy_lottery_tickets', { p_quantity: 0, p_lottery_id: g })).error).toBeTruthy();
    await ok(service.from('lottery_games').update({ sales_open: false }).eq('id', g));
    expect((await p.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g })).error?.message).toMatch(/closed/);
    await ok(service.from('lottery_games').update({ sales_open: true, draw_at: new Date(Date.now() - 1000).toISOString() }).eq('id', g));
    expect((await p.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g })).error?.message).toMatch(/closed/);
    expect((await anon().rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g })).error).toBeTruthy();
    expect(await gold(p.id)).toBe(500);
  });

  it('never spends more than the balance when the same player buys in parallel', async () => {
    const g = await game(10, 0);
    const p = await player(33); // enough for three single tickets (11 each), not four
    const results = await Promise.all(Array.from({ length: 8 }, () => p.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g })));
    expect(results.filter((r) => !r.error)).toHaveLength(3);
    expect(await gold(p.id)).toBe(0);
    expect(await pool(g)).toBe(30);
  });

  it('gives every ticket its own number when many players buy at once', async () => {
    const g = await game(10, 0);
    const players = await Promise.all(Array.from({ length: 6 }, () => player(1000)));
    await Promise.all(players.map((p) => must(p.client.rpc('buy_lottery_tickets', { p_quantity: 5, p_lottery_id: g }))));
    const draw = (await must(service.from('lottery_games').select('current_draw_id').eq('id', g).single())).current_draw_id!;
    const numbers = (await must(service.from('lottery_tickets').select('ticket_number').eq('draw_id', draw))).map((t) => t.ticket_number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });
});

describe('withdrawals', () => {
  it('holds the gold, and a rejection gives it back exactly once', async () => {
    const org = await organizer();
    const p = await player(100);
    const id = await must(p.client.rpc('request_lottery_withdrawal', { p_amount: 60 }));
    expect(await gold(p.id)).toBe(40);
    const [a, b] = await Promise.all([
      org.client.rpc('admin_process_withdrawal', { p_request_id: id, p_approve: false }),
      org.client.rpc('admin_process_withdrawal', { p_request_id: id, p_approve: false }),
    ]);
    expect([a.error, b.error].filter(Boolean)).toHaveLength(1);
    expect(await gold(p.id)).toBe(100);
  });

  it('completing one keeps the gold out; asking for more than the balance is refused', async () => {
    const org = await organizer();
    const p = await player(100);
    expect((await p.client.rpc('request_lottery_withdrawal', { p_amount: 101 })).error).toBeTruthy();
    const id = await must(p.client.rpc('request_lottery_withdrawal', { p_amount: 100 }));
    await ok(org.client.rpc('admin_process_withdrawal', { p_request_id: id, p_approve: true }));
    expect(await gold(p.id)).toBe(0);
    expect((await org.client.rpc('admin_process_withdrawal', { p_request_id: id, p_approve: false })).error).toBeTruthy();
    expect(await gold(p.id)).toBe(0);
  });
});

describe('deposit requests', () => {
  it('a player may have three waiting, even when sending many at once', async () => {
    const p = await player();
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => p.client.rpc('request_lottery_deposit', { p_amount: 10 + i })));
    expect(results.filter((r) => !r.error)).toHaveLength(3);
    expect(await must(p.client.from('deposit_requests').select('id').eq('status', 'pending'))).toHaveLength(3);
    expect((await p.client.rpc('request_lottery_deposit', { p_amount: 0 })).error).toBeTruthy();
  });

  it('the organizer credits one exactly once, and a rejected one credits nothing', async () => {
    const org = await organizer();
    const p = await player();
    const paid = await must(p.client.rpc('request_lottery_deposit', { p_amount: 40 }));
    const refused = await must(p.client.rpc('request_lottery_deposit', { p_amount: 70 }));
    const [x, y] = await Promise.all([
      org.client.rpc('admin_process_deposit', { p_request_id: paid, p_approve: true }),
      org.client.rpc('admin_process_deposit', { p_request_id: paid, p_approve: true }),
    ]);
    expect([x.error, y.error].filter(Boolean)).toHaveLength(1);
    await ok(org.client.rpc('admin_process_deposit', { p_request_id: refused, p_approve: false }));
    expect(await gold(p.id)).toBe(40);
  });

  it('a player can’t settle their own', async () => {
    const p = await player();
    const id = await must(p.client.rpc('request_lottery_deposit', { p_amount: 40 }));
    expect((await p.client.rpc('admin_process_deposit', { p_request_id: id, p_approve: true })).error).toBeTruthy();
    expect(await gold(p.id)).toBe(0);
  });
});

describe('the organizer', () => {
  it('credits gold by username, in any case', async () => {
    const org = await organizer();
    const p = await player();
    expect(await must(org.client.rpc('admin_credit_gold', { p_username: p.username.toUpperCase(), p_amount: 25 }))).toBe(25);
    expect(await gold(p.id)).toBe(25);
  });

  it('draws one sold ticket, pays it the pool, records it, and opens an empty draw at the seed', async () => {
    const org = await organizer();
    const g = await game(10, 100);
    const a = await player(500), b = await player(500);
    await must(a.client.rpc('buy_lottery_tickets', { p_quantity: 3, p_lottery_id: g }));
    await must(b.client.rpc('buy_lottery_tickets', { p_quantity: 2, p_lottery_id: g }));
    const [won] = await must(org.client.rpc('admin_close_and_draw', { p_lottery_id: g }));
    expect(won!.prize_gold).toBe(150);
    const winner = won!.winner_username === a.username ? a : b;
    expect(await gold(winner.id)).toBe(winner === a ? 500 - 33 + 150 : 500 - 22 + 150);
    const history = await must(anon().from('draw_history').select('winner_username,prize_gold,lottery_id,ticket_number').eq('lottery_id', g));
    expect(history).toEqual([{ winner_username: winner.username, prize_gold: 150, lottery_id: g, ticket_number: won!.ticket_number }]);
    const next = await must(service.from('lottery_games').select('jackpot,sales_open,draw_at').eq('id', g).single());
    expect(next).toEqual({ jackpot: 100, sales_open: true, draw_at: null });
    expect((await org.client.rpc('admin_close_and_draw', { p_lottery_id: g })).error?.message).toMatch(/No tickets/);
  });

  it('refuses every organizer function to a player', async () => {
    const g = await game();
    const p = await player(100);
    const calls = [
      p.client.rpc('admin_credit_gold', { p_username: p.username, p_amount: 5 }),
      p.client.rpc('admin_set_jackpot', { p_amount: 1, p_lottery_id: g }),
      p.client.rpc('admin_set_ticket_price', { p_ticket_price: 1, p_lottery_id: g }),
      p.client.rpc('admin_close_and_draw', { p_lottery_id: g }),
      p.client.rpc('admin_reopen_draw', { p_lottery_id: g }),
      p.client.rpc('admin_delete_all_lottery_tickets'),
      p.client.rpc('admin_reset_lottery_data'),
      p.client.rpc('admin_get_fee_earnings'),
    ];
    for (const r of await Promise.all(calls)) expect(r.error?.message).toMatch(/Organizer sign-in required|permission denied/);
    expect(await gold(p.id)).toBe(100);
  });
});

describe('who may read and write what', () => {
  it('a player reads their own profile and tickets, not anyone else’s', async () => {
    const g = await game();
    const a = await player(100), b = await player(100);
    await must(b.client.rpc('buy_lottery_tickets', { p_quantity: 1, p_lottery_id: g }));
    expect(await must(a.client.from('player_profiles').select('user_id'))).toEqual([{ user_id: a.id }]);
    expect(await must(a.client.from('lottery_tickets').select('id').eq('user_id', b.id))).toEqual([]);
  });

  it('a player can’t change gold, tickets or pools by writing tables', async () => {
    const g = await game();
    const p = await player(100);
    await p.client.from('player_profiles').update({ gold: 999999 }).eq('user_id', p.id);
    await p.client.from('lottery_games').update({ jackpot: 0 }).eq('id', g);
    const draw = (await must(service.from('lottery_games').select('current_draw_id').eq('id', g).single())).current_draw_id!;
    const insert = await p.client.from('lottery_tickets').insert({ lottery_id: g, draw_id: draw, user_id: p.id, ticket_number: 1, price_paid: 0 });
    expect(insert.error).toBeTruthy();
    expect(await gold(p.id)).toBe(100);
    expect(await pool(g)).toBe(100);
  });

  it('visitors see games and winners, and nothing about players', async () => {
    const visitor = anon();
    expect((await visitor.from('lottery_games').select('id')).data?.length).toBeGreaterThan(0);
    expect((await visitor.from('draw_history').select('id')).error).toBeNull();
    expect((await visitor.from('player_profiles').select('user_id')).data ?? []).toEqual([]);
    expect((await visitor.from('withdrawal_requests').select('id')).data ?? []).toEqual([]);
  });
});
