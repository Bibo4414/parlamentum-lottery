-- Security pass over the money paths and the draw.
--
-- 1. A gold ledger: every change to a balance writes a line (who, how much, why), including the organizer's credits
--    by hand, which left no trace before. gold_mismatches lists any balance the ledger can't explain.
-- 2. Draws anyone can check: a secret seed is fixed when a draw opens and only its SHA-256 is shown; the winner comes
--    from the seed and the list of tickets; after the draw the seed and the list are published.
-- 3. No more lost gold: deleting tickets or resetting refunds every ticket of an open draw (price and fee), keeps the
--    winners' history, and a draw can't be thrown away by "reopening" over it.
-- 4. Limits the page promised or needed: the pool never drops below what players paid in, three withdrawals waiting
--    at most, no draw before its announced time, and no tickets for organizer accounts.

-- Functions are replaced whatever argument types the live project gave them: every overload of the name goes first,
-- so the API never ends up with two candidates for one call.
create function pg_temp.drop_everywhere(fn text) returns void language plpgsql as $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = fn loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

-- ---------- 1. the gold ledger ----------

create table public.gold_moves (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.player_profiles (user_id),
  delta bigint not null check (delta <> 0),
  kind text not null check (kind in ('opening', 'deposit', 'credit', 'tickets', 'refund', 'prize', 'withdrawal', 'withdrawal_refund')),
  ref text,
  note text,
  actor uuid,
  created_at timestamptz not null default now()
);
create index gold_moves_user on public.gold_moves (user_id, created_at desc);
alter table public.gold_moves enable row level security;
revoke all on public.gold_moves from anon, authenticated;
grant select on public.gold_moves to authenticated;
create policy "own moves, or the organizer" on public.gold_moves for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_lottery_admin()));

-- what everyone held when the ledger started
insert into public.gold_moves (user_id, delta, kind, note)
  select user_id, gold, 'opening', 'balance when the ledger started' from public.player_profiles where gold <> 0;

/** Changes one balance and writes its line, or raises; never takes a balance below zero. Not callable by clients. */
create function public.move_gold(p_user uuid, p_delta bigint, p_kind text, p_ref text default null, p_note text default null)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  balance bigint;
begin
  update public.player_profiles set gold = gold + p_delta where user_id = p_user and gold + p_delta >= 0 returning gold into balance;
  if not found then
    if exists (select 1 from public.player_profiles where user_id = p_user) then raise exception 'Not enough gold.'; end if;
    raise exception 'No such player.';
  end if;
  insert into public.gold_moves (user_id, delta, kind, ref, note, actor) values (p_user, p_delta, p_kind, p_ref, p_note, auth.uid());
  return balance;
end $$;

/** Balances the ledger can't explain: someone changed gold outside the functions (in the dashboard, say). */
create function public.gold_mismatches()
returns table (username text, gold bigint, ledger bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  return query
    select p.username, p.gold, coalesce(sum(m.delta), 0)::bigint
    from public.player_profiles p left join public.gold_moves m on m.user_id = p.user_id
    group by p.user_id, p.username, p.gold
    having p.gold <> coalesce(sum(m.delta), 0);
end $$;

-- ---------- 2. draws anyone can check ----------

alter table public.lottery_draws drop constraint lottery_draws_status_check;
alter table public.lottery_draws
  add constraint lottery_draws_status_check check (status in ('open', 'drawn', 'cancelled')),
  add column seed_hash text,
  add column seed text,
  add column ticket_count int,
  add column tickets_digest text,
  add column winning_index int,
  add column winning_ticket int;

-- the seed of each open draw, until the draw: no policy, so no client can read it
create table public.lottery_draw_secrets (
  draw_id bigint primary key references public.lottery_draws (id),
  seed text not null
);
alter table public.lottery_draw_secrets enable row level security;
revoke all on public.lottery_draw_secrets from anon, authenticated;

alter table public.ticket_purchases add column refunded_at timestamptz;

/** Opens a draw with a fresh secret seed and publishes only its SHA-256. Internal. */
create function public.open_draw(p_lottery_id text) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  draw bigint;
  secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.lottery_draws (lottery_id, seed_hash)
    values (p_lottery_id, encode(extensions.digest(secret, 'sha256'), 'hex')) returning id into draw;
  insert into public.lottery_draw_secrets (draw_id, seed) values (draw, secret);
  return draw;
end $$;

-- draws already open get their commitment now
do $$
declare d record; secret text;
begin
  for d in select id from public.lottery_draws where status = 'open' and seed_hash is null loop
    secret := encode(extensions.gen_random_bytes(32), 'hex');
    update public.lottery_draws set seed_hash = encode(extensions.digest(secret, 'sha256'), 'hex') where id = d.id;
    insert into public.lottery_draw_secrets (draw_id, seed) values (d.id, secret);
  end loop;
end $$;

/** The tickets of a finished draw, in the order the winner was counted in: what players check the draw against. */
create function public.draw_tickets(p_draw_id bigint)
returns table (ticket_number int, username text)
language sql stable security definer set search_path = ''
as $$
  select t.ticket_number, p.username
  from public.lottery_tickets t join public.player_profiles p on p.user_id = t.user_id
  where t.draw_id = p_draw_id and exists (select 1 from public.lottery_draws d where d.id = p_draw_id and d.status = 'drawn')
  order by t.ticket_number
$$;

/** Refunds every ticket of a draw (what each purchase cost, fee included), takes the prices back out of its pool and
 *  removes the tickets. Internal; the caller holds the game row. */
create function public.refund_draw(p_draw_id bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  pur record;
  loose record;
  refunded bigint := 0;
  prices bigint := 0;
begin
  for pur in select * from public.ticket_purchases where draw_id = p_draw_id and refunded_at is null order by id for update loop
    perform public.move_gold(pur.user_id, pur.price_each * pur.quantity + pur.fee, 'refund', 'purchase:' || pur.id, 'tickets cancelled by the organizer');
    update public.ticket_purchases set refunded_at = now() where id = pur.id;
    refunded := refunded + pur.price_each * pur.quantity + pur.fee;
    prices := prices + pur.price_each * pur.quantity;
  end loop;
  -- tickets from before purchases were recorded: their price, since their fee is unknown
  for loose in select user_id, sum(price_paid)::bigint as paid from public.lottery_tickets
               where draw_id = p_draw_id and purchase_id is null group by user_id loop
    if loose.paid > 0 then
      perform public.move_gold(loose.user_id, loose.paid, 'refund', 'draw:' || p_draw_id, 'tickets cancelled by the organizer');
      refunded := refunded + loose.paid;
      prices := prices + loose.paid;
    end if;
  end loop;
  delete from public.lottery_tickets where draw_id = p_draw_id;
  update public.lottery_games set jackpot = greatest(jackpot - prices, 0), updated_at = now() where current_draw_id = p_draw_id;
  return refunded;
end $$;

-- ---------- players ----------

select pg_temp.drop_everywhere('buy_lottery_tickets');
create function public.buy_lottery_tickets(p_quantity int, p_lottery_id text)
returns table (id bigint, ticket_number int)
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g public.lottery_games;
  cost bigint;
  fee bigint;
  purchase bigint;
  first_number int;
begin
  if me is null then raise exception 'Create an account or log in first.'; end if;
  -- the organizer sees each draw's secret seed, so organizer accounts don't play
  if public.is_lottery_admin() then raise exception 'Organizer accounts can''t buy tickets.'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then raise exception 'Choose 1 to 10 tickets.'; end if;
  select * into g from public.lottery_games where lottery_games.id = p_lottery_id for update;
  if not found or g.current_draw_id is null then raise exception 'Unknown lottery.'; end if;
  if not g.sales_open or (g.draw_at is not null and g.draw_at <= now()) then raise exception 'Ticket sales are closed.'; end if;

  cost := g.ticket_price * p_quantity;
  fee := (cost + 9) / 10;
  insert into public.ticket_purchases (user_id, lottery_id, draw_id, quantity, price_each, fee)
    values (me, g.id, g.current_draw_id, p_quantity, g.ticket_price, fee) returning ticket_purchases.id into purchase;
  begin
    perform public.move_gold(me, -(cost + fee), 'tickets', 'purchase:' || purchase, p_quantity || ' × ' || g.name);
  exception when raise_exception then
    raise exception 'Not enough gold: % tickets cost % gold with the fee.', p_quantity, cost + fee;
  end;
  select coalesce(max(t.ticket_number), 0) + 1 into first_number from public.lottery_tickets t where t.draw_id = g.current_draw_id;
  update public.lottery_games set jackpot = jackpot + cost, updated_at = now() where lottery_games.id = g.id;

  return query
    insert into public.lottery_tickets (lottery_id, draw_id, user_id, purchase_id, ticket_number, price_paid)
    select g.id, g.current_draw_id, me, purchase, first_number + n, g.ticket_price from generate_series(0, p_quantity - 1) n
    returning lottery_tickets.id, lottery_tickets.ticket_number;
end $$;

select pg_temp.drop_everywhere('request_lottery_withdrawal');
create function public.request_lottery_withdrawal(p_amount bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  request bigint;
begin
  if me is null then raise exception 'Log in before requesting a withdrawal.'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Enter a whole gold amount of at least 1.'; end if;
  perform 1 from public.player_profiles where user_id = me for update;
  if (select count(*) from public.withdrawal_requests where user_id = me and status = 'pending') >= 3 then
    raise exception 'You have 3 withdrawals waiting. Wait for one to be paid before asking for another.';
  end if;
  insert into public.withdrawal_requests (user_id, amount) values (me, p_amount) returning id into request;
  perform public.move_gold(me, -p_amount, 'withdrawal', 'withdrawal:' || request, 'held until paid');
  return request;
end $$;

-- ---------- the organizer: gold ----------

select pg_temp.drop_everywhere('admin_credit_gold');
create function public.admin_credit_gold(p_username text, p_amount bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  who uuid;
begin
  perform public.require_lottery_admin();
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then raise exception 'Enter a whole amount from 1 to 1,000,000.'; end if;
  select user_id into who from public.player_profiles where lower(username) = lower(btrim(p_username));
  if not found then raise exception 'No player is called %.', p_username; end if;
  return public.move_gold(who, p_amount, 'credit', null, 'added by hand');
end $$;

select pg_temp.drop_everywhere('admin_process_withdrawal');
create function public.admin_process_withdrawal(p_request_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.withdrawal_requests;
begin
  perform public.require_lottery_admin();
  update public.withdrawal_requests
    set status = case when p_approve then 'completed' else 'rejected' end, processed_at = now(), processed_by = auth.uid()
    where id = p_request_id and status = 'pending' returning * into r;
  if not found then raise exception 'That withdrawal was already handled.'; end if;
  if not p_approve then
    perform public.move_gold(r.user_id, r.amount, 'withdrawal_refund', 'withdrawal:' || r.id, 'withdrawal rejected');
  end if;
end $$;

select pg_temp.drop_everywhere('admin_process_deposit');
create function public.admin_process_deposit(p_request_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.deposit_requests;
begin
  perform public.require_lottery_admin();
  update public.deposit_requests
    set status = case when p_approve then 'approved' else 'rejected' end, processed_at = now(), processed_by = auth.uid()
    where id = p_request_id and status = 'pending' returning * into r;
  if not found then raise exception 'That deposit was already handled.'; end if;
  if p_approve then
    perform public.move_gold(r.user_id, r.amount, 'deposit', 'deposit_request:' || r.id, 'approved by hand');
  end if;
end $$;

select pg_temp.drop_everywhere('admin_get_fee_earnings');
create function public.admin_get_fee_earnings() returns bigint
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  return (select coalesce(sum(fee), 0) from public.ticket_purchases where refunded_at is null);
end $$;

-- ---------- the organizer: pools and draws ----------

select pg_temp.drop_everywhere('admin_set_jackpot');
create function public.admin_set_jackpot(p_amount bigint, p_lottery_id text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.lottery_games;
  paid_in bigint;
begin
  perform public.require_lottery_admin();
  if p_amount is null or p_amount < 0 or p_amount > 1000000000 then raise exception 'Enter a valid whole jackpot amount.'; end if;
  select * into g from public.lottery_games where id = p_lottery_id for update;
  if not found then raise exception 'Unknown lottery.'; end if;
  select coalesce(sum(price_paid), 0) into paid_in from public.lottery_tickets where draw_id = g.current_draw_id;
  -- the ticket prices players paid into this draw belong to its winner
  if p_amount < paid_in then raise exception 'Players have paid % gold into this pool; it can''t be set lower.', paid_in; end if;
  update public.lottery_games set jackpot = p_amount, updated_at = now() where id = g.id;
end $$;

select pg_temp.drop_everywhere('admin_close_and_draw');
create function public.admin_close_and_draw(p_lottery_id text)
returns table (winner_username text, ticket_number int, prize_gold bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  g public.lottery_games;
  draw public.lottery_draws;
  secret text;
  list text;
  digest text;
  n int;
  pick int;
  winner record;
begin
  perform public.require_lottery_admin();
  select * into g from public.lottery_games where id = p_lottery_id for update;
  if not found then raise exception 'Unknown lottery.'; end if;
  if g.draw_at is not null and g.draw_at > now() then
    raise exception 'This draw is announced for % UTC. Clear the draw time first to draw earlier.', to_char(g.draw_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI');
  end if;
  select * into draw from public.lottery_draws where id = g.current_draw_id for update;
  select s.seed into secret from public.lottery_draw_secrets s where s.draw_id = draw.id;
  if draw.status <> 'open' or secret is null then raise exception 'This draw can''t be drawn.'; end if;

  -- the tickets, in number order, as one text: "number:username" a line
  select count(*), string_agg(t.ticket_number || ':' || p.username, E'\n' order by t.ticket_number)
    into n, list
    from public.lottery_tickets t join public.player_profiles p on p.user_id = t.user_id where t.draw_id = draw.id;
  if n = 0 then raise exception 'No tickets were sold in this draw.'; end if;
  digest := encode(extensions.digest(list, 'sha256'), 'hex');
  -- the winner's place in that list: the first 52 bits of SHA-256(seed:draw:digest), modulo the number of tickets
  pick := (('x' || lpad(substr(encode(extensions.digest(secret || ':' || draw.id || ':' || digest, 'sha256'), 'hex'), 1, 13), 16, '0'))::bit(64)::bigint % n)::int;
  select t.ticket_number as num, t.user_id, p.username into winner
    from public.lottery_tickets t join public.player_profiles p on p.user_id = t.user_id
    where t.draw_id = draw.id order by t.ticket_number offset pick limit 1;

  perform public.move_gold(winner.user_id, g.jackpot, 'prize', 'draw:' || draw.id, g.name || ', ticket #' || winner.num);
  insert into public.draw_history (lottery_id, draw_id, winner_user_id, winner_username, ticket_number, prize_gold)
    values (g.id, draw.id, winner.user_id, winner.username, winner.num, g.jackpot);
  update public.lottery_draws
    set status = 'drawn', drawn_at = now(), seed = secret, ticket_count = n, tickets_digest = digest, winning_index = pick, winning_ticket = winner.num
    where id = draw.id;
  delete from public.lottery_draw_secrets where draw_id = draw.id;
  -- "The jackpot is paid to the winner automatically and a new empty draw starts."
  update public.lottery_games
    set current_draw_id = public.open_draw(g.id), sales_open = true, draw_at = null, jackpot = default_jackpot, updated_at = now()
    where id = g.id;
  return query select winner.username, winner.num, g.jackpot;
end $$;

select pg_temp.drop_everywhere('admin_reopen_draw');
create function public.admin_reopen_draw(p_lottery_id text) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  g public.lottery_games;
  draw bigint;
begin
  perform public.require_lottery_admin();
  select * into g from public.lottery_games where id = p_lottery_id for update;
  if not found then raise exception 'Unknown lottery.'; end if;
  -- tickets in the open draw would be left behind in a draw that never happens
  if exists (select 1 from public.lottery_tickets where draw_id = g.current_draw_id) then
    raise exception 'This draw has tickets. Draw it, or cancel it with a refund, before starting another.';
  end if;
  update public.lottery_draws set status = 'cancelled' where id = g.current_draw_id and status = 'open';
  delete from public.lottery_draw_secrets where draw_id = g.current_draw_id;
  draw := public.open_draw(g.id);
  update public.lottery_games set current_draw_id = draw, sales_open = true, draw_at = null, jackpot = default_jackpot, updated_at = now()
    where id = g.id;
  return draw;
end $$;

-- "Delete all tickets": every open draw's tickets are refunded, price and fee, and their prices leave the pools
select pg_temp.drop_everywhere('admin_delete_all_lottery_tickets');
create function public.admin_delete_all_lottery_tickets() returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  g record;
  refunded bigint := 0;
begin
  perform public.require_lottery_admin();
  for g in select id, current_draw_id from public.lottery_games order by id for update loop
    refunded := refunded + public.refund_draw(g.current_draw_id);
  end loop;
  return refunded;
end $$;

-- "Reset": open draws are refunded and replaced by fresh ones at the seed; the winners' history stays
select pg_temp.drop_everywhere('admin_reset_lottery_data');
create function public.admin_reset_lottery_data() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g record;
begin
  perform public.require_lottery_admin();
  for g in select id, current_draw_id from public.lottery_games order by id for update loop
    perform public.refund_draw(g.current_draw_id);
    update public.lottery_draws set status = 'cancelled' where id = g.current_draw_id;
    delete from public.lottery_draw_secrets where draw_id = g.current_draw_id;
    update public.lottery_games set current_draw_id = public.open_draw(g.id), sales_open = true, draw_at = null, jackpot = default_jackpot, updated_at = now()
      where id = g.id;
  end loop;
end $$;

-- ---------- who may call what ----------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_lottery_admin() to anon, authenticated;
grant execute on function public.draw_tickets(bigint) to anon, authenticated;
grant execute on function
  public.buy_lottery_tickets(int, text),
  public.request_lottery_withdrawal(bigint),
  public.request_lottery_deposit(bigint),
  public.admin_credit_gold(text, bigint),
  public.admin_process_withdrawal(bigint, boolean),
  public.admin_process_deposit(bigint, boolean),
  public.admin_get_fee_earnings(),
  public.admin_set_ticket_price(bigint, text),
  public.admin_set_jackpot(bigint, text),
  public.admin_reset_jackpot_to_ticket_total(text),
  public.admin_set_sales_open(boolean, text),
  public.admin_set_draw_time(text, timestamptz),
  public.admin_close_and_draw(text),
  public.admin_reopen_draw(text),
  public.admin_delete_all_lottery_tickets(),
  public.admin_reset_lottery_data(),
  public.gold_mismatches()
to authenticated;
