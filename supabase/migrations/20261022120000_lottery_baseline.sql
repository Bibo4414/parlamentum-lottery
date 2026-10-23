-- The lottery's backend as code: a reconstruction of what index.html relies on.
--
-- The live project's SQL was only ever pasted into the Supabase dashboard, so this file rebuilds it from the page:
-- every table it reads, the trigger that turns a sign-up into a player profile, and every RPC it calls, with the
-- arguments it passes and the behaviour its labels describe ("does not change player gold balances", "deletes all
-- tickets and winner history", ...). Row-level security and the organizer checks are written the safe way, since
-- the live versions can't be seen; supabase/audit.sql checks the live project for the same things.
--
-- Money is whole gold (bigint). Every change to it happens inside one of the functions below, never by a client
-- writing a table.

create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------

create table public.lottery_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create table public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_ -]{3,24}$'),
  gold bigint not null default 0 check (gold >= 0),
  created_at timestamptz not null default now()
);
create unique index player_profiles_username_key on public.player_profiles (lower(username));

create table public.lottery_games (
  id text primary key check (id ~ '^[a-z0-9_-]{1,24}$'),
  name text not null,
  jackpot bigint not null default 0 check (jackpot >= 0),
  default_jackpot bigint not null default 0 check (default_jackpot >= 0),
  ticket_price bigint not null check (ticket_price between 1 and 1000000),
  sales_open boolean not null default true,
  draw_at timestamptz,
  current_draw_id bigint,
  updated_at timestamptz not null default now()
);

create table public.lottery_draws (
  id bigint generated always as identity primary key,
  lottery_id text not null references public.lottery_games (id),
  status text not null default 'open' check (status in ('open', 'drawn')),
  opened_at timestamptz not null default now(),
  drawn_at timestamptz
);
alter table public.lottery_games
  add constraint lottery_games_current_draw_fk foreign key (current_draw_id) references public.lottery_draws (id);

create table public.ticket_purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.player_profiles (user_id),
  lottery_id text not null references public.lottery_games (id),
  draw_id bigint not null references public.lottery_draws (id),
  quantity int not null check (quantity > 0),
  price_each bigint not null check (price_each > 0),
  fee bigint not null check (fee >= 0),
  created_at timestamptz not null default now()
);

create table public.lottery_tickets (
  id bigint generated always as identity primary key,
  lottery_id text not null references public.lottery_games (id),
  draw_id bigint not null references public.lottery_draws (id),
  user_id uuid not null references public.player_profiles (user_id),
  purchase_id bigint references public.ticket_purchases (id),
  ticket_number int not null check (ticket_number > 0),
  price_paid bigint not null check (price_paid >= 0),
  created_at timestamptz not null default now(),
  unique (draw_id, ticket_number)
);
create index lottery_tickets_owner on public.lottery_tickets (user_id, draw_id);

create table public.draw_history (
  id bigint generated always as identity primary key,
  lottery_id text references public.lottery_games (id),
  draw_id bigint references public.lottery_draws (id),
  winner_user_id uuid references public.player_profiles (user_id),
  winner_username text,
  ticket_number int,
  prize_gold bigint not null check (prize_gold >= 0),
  drawn_at timestamptz not null default now()
);

create table public.withdrawal_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.player_profiles (user_id),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid
);
create index withdrawal_requests_pending on public.withdrawal_requests (created_at) where status = 'pending';

-- a player's "I've paid" for a Raw Copper purchase, waiting for the organizer to check the trade
create table public.deposit_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.player_profiles (user_id),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid
);

-- ---------- who is the organizer ----------

create function public.is_lottery_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.lottery_admins where user_id = auth.uid()) $$;

create function public.require_lottery_admin() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_lottery_admin() then
    raise exception 'Organizer sign-in required.' using errcode = '42501';
  end if;
end $$;

-- ---------- a sign-up becomes a player ----------

create function public.handle_new_player() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  name text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if name !~ '^[A-Za-z0-9_ -]{3,24}$' then
    raise exception 'Username must be 3–24 characters (letters, numbers, spaces, _ or -).';
  end if;
  insert into public.player_profiles (user_id, username) values (new.id, name);
  return new;
exception when unique_violation then
  raise exception 'That username is taken.';
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_player();

-- ---------- row-level security: clients read, functions write ----------

alter table public.lottery_admins enable row level security;
alter table public.player_profiles enable row level security;
alter table public.lottery_games enable row level security;
alter table public.lottery_draws enable row level security;
alter table public.ticket_purchases enable row level security;
alter table public.lottery_tickets enable row level security;
alter table public.draw_history enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.deposit_requests enable row level security;

revoke all on public.lottery_admins, public.player_profiles, public.lottery_games, public.lottery_draws,
  public.ticket_purchases, public.lottery_tickets, public.draw_history, public.withdrawal_requests,
  public.deposit_requests from anon, authenticated;

grant select on public.lottery_games, public.lottery_draws, public.draw_history to anon, authenticated;
grant select on public.player_profiles, public.ticket_purchases, public.lottery_tickets, public.withdrawal_requests,
  public.deposit_requests to authenticated;

create policy "games are public" on public.lottery_games for select using (true);
create policy "draws are public" on public.lottery_draws for select using (true);
create policy "winners are public" on public.draw_history for select using (true);
create policy "own profile, or the organizer" on public.player_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_lottery_admin()));
create policy "own purchases, or the organizer" on public.ticket_purchases for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_lottery_admin()));
create policy "own tickets, or the organizer" on public.lottery_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_lottery_admin()));
create policy "own withdrawals, or the organizer" on public.withdrawal_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_lottery_admin()));
create policy "own deposits, or the organizer" on public.deposit_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_lottery_admin()));

-- ---------- players ----------

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
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then raise exception 'Choose 1 to 10 tickets.'; end if;
  -- the game row is locked for the whole purchase: ticket numbers and the pool move one buyer at a time
  select * into g from public.lottery_games where lottery_games.id = p_lottery_id for update;
  if not found or g.current_draw_id is null then raise exception 'Unknown lottery.'; end if;
  if not g.sales_open or (g.draw_at is not null and g.draw_at <= now()) then raise exception 'Ticket sales are closed.'; end if;

  cost := g.ticket_price * p_quantity;
  fee := (cost + 9) / 10; -- the 10% organizer fee, rounded up
  update public.player_profiles set gold = gold - (cost + fee) where user_id = me and gold >= cost + fee;
  if not found then raise exception 'Not enough gold: % tickets cost % gold with the fee.', p_quantity, cost + fee; end if;

  insert into public.ticket_purchases (user_id, lottery_id, draw_id, quantity, price_each, fee)
    values (me, g.id, g.current_draw_id, p_quantity, g.ticket_price, fee) returning ticket_purchases.id into purchase;
  select coalesce(max(t.ticket_number), 0) + 1 into first_number from public.lottery_tickets t where t.draw_id = g.current_draw_id;
  update public.lottery_games set jackpot = jackpot + cost, updated_at = now() where lottery_games.id = g.id;

  return query
    insert into public.lottery_tickets (lottery_id, draw_id, user_id, purchase_id, ticket_number, price_paid)
    select g.id, g.current_draw_id, me, purchase, first_number + n, g.ticket_price from generate_series(0, p_quantity - 1) n
    returning lottery_tickets.id, lottery_tickets.ticket_number;
end $$;

create function public.request_lottery_withdrawal(p_amount bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  request bigint;
begin
  if me is null then raise exception 'Log in before requesting a withdrawal.'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Enter a whole gold amount of at least 1.'; end if;
  update public.player_profiles set gold = gold - p_amount where user_id = me and gold >= p_amount;
  if not found then raise exception 'Not enough gold.'; end if;
  insert into public.withdrawal_requests (user_id, amount) values (me, p_amount) returning id into request;
  return request;
end $$;

-- "After you buy, enter the same amount below. I'll check the trade and approve it ... up to 3 pending requests"
create function public.request_lottery_deposit(p_amount bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  request bigint;
begin
  if me is null then raise exception 'Log in before requesting a deposit.'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then raise exception 'Enter a whole amount from 1 to 1,000,000.'; end if;
  -- the player's row is locked so two requests at once can't both pass the count
  perform 1 from public.player_profiles where user_id = me for update;
  if (select count(*) from public.deposit_requests where user_id = me and status = 'pending') >= 3 then
    raise exception 'You have 3 pending requests. Wait for one to be approved before sending another.';
  end if;
  insert into public.deposit_requests (user_id, amount) values (me, p_amount) returning id into request;
  return request;
end $$;

-- ---------- the organizer: gold ----------

create function public.admin_credit_gold(p_username text, p_amount bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  balance bigint;
begin
  perform public.require_lottery_admin();
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then raise exception 'Enter a whole amount from 1 to 1,000,000.'; end if;
  update public.player_profiles set gold = gold + p_amount where lower(username) = lower(btrim(p_username)) returning gold into balance;
  if not found then raise exception 'No player is called %.', p_username; end if;
  return balance;
end $$;

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
    update public.player_profiles set gold = gold + r.amount where user_id = r.user_id;
  end if;
end $$;

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
    update public.player_profiles set gold = gold + r.amount where user_id = r.user_id;
  end if;
end $$;

create function public.admin_get_fee_earnings() returns bigint
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  return (select coalesce(sum(fee), 0) from public.ticket_purchases);
end $$;

-- ---------- the organizer: games and draws ----------

create function public.admin_set_ticket_price(p_ticket_price bigint, p_lottery_id text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  if p_ticket_price is null or p_ticket_price < 1 or p_ticket_price > 1000000 then raise exception 'Enter a whole ticket price from 1 to 1,000,000 gold.'; end if;
  update public.lottery_games set ticket_price = p_ticket_price, updated_at = now() where id = p_lottery_id;
  if not found then raise exception 'Unknown lottery.'; end if;
end $$;

create function public.admin_set_jackpot(p_amount bigint, p_lottery_id text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  if p_amount is null or p_amount < 0 or p_amount > 1000000000 then raise exception 'Enter a valid whole jackpot amount.'; end if;
  update public.lottery_games set jackpot = p_amount, updated_at = now() where id = p_lottery_id;
  if not found then raise exception 'Unknown lottery.'; end if;
end $$;

create function public.admin_reset_jackpot_to_ticket_total(p_lottery_id text) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  total bigint;
begin
  perform public.require_lottery_admin();
  select coalesce(sum(t.price_paid), 0) into total
    from public.lottery_games g join public.lottery_tickets t on t.draw_id = g.current_draw_id where g.id = p_lottery_id;
  update public.lottery_games set jackpot = total, updated_at = now() where id = p_lottery_id;
  if not found then raise exception 'Unknown lottery.'; end if;
  return total;
end $$;

create function public.admin_set_sales_open(p_open boolean, p_lottery_id text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  update public.lottery_games set sales_open = coalesce(p_open, false), updated_at = now() where id = p_lottery_id;
  if not found then raise exception 'Unknown lottery.'; end if;
end $$;

create function public.admin_set_draw_time(p_lottery_id text, p_draw_at timestamptz) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  if p_draw_at is not null and p_draw_at <= now() then raise exception 'Choose a future UTC date and time.'; end if;
  update public.lottery_games set draw_at = p_draw_at, updated_at = now() where id = p_lottery_id;
  if not found then raise exception 'Unknown lottery.'; end if;
end $$;

create function public.admin_close_and_draw(p_lottery_id text)
returns table (winner_username text, ticket_number int, prize_gold bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  g public.lottery_games;
  winner public.lottery_tickets;
  name text;
  next_draw bigint;
begin
  perform public.require_lottery_admin();
  select * into g from public.lottery_games where id = p_lottery_id for update;
  if not found then raise exception 'Unknown lottery.'; end if;
  select * into winner from public.lottery_tickets t where t.draw_id = g.current_draw_id order by random() limit 1;
  if not found then raise exception 'No tickets were sold in this draw.'; end if;

  select username into name from public.player_profiles where user_id = winner.user_id;
  update public.player_profiles set gold = gold + g.jackpot where user_id = winner.user_id;
  insert into public.draw_history (lottery_id, draw_id, winner_user_id, winner_username, ticket_number, prize_gold)
    values (g.id, g.current_draw_id, winner.user_id, name, winner.ticket_number, g.jackpot);
  update public.lottery_draws set status = 'drawn', drawn_at = now() where id = g.current_draw_id;
  -- "The jackpot is paid to the winner automatically and a new empty draw starts."
  insert into public.lottery_draws (lottery_id) values (g.id) returning id into next_draw;
  update public.lottery_games
    set current_draw_id = next_draw, sales_open = true, draw_at = null, jackpot = default_jackpot, updated_at = now()
    where id = g.id;
  return query select name, winner.ticket_number, g.jackpot;
end $$;

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
  insert into public.lottery_draws (lottery_id) values (g.id) returning id into draw;
  update public.lottery_games
    set current_draw_id = draw, sales_open = true, draw_at = null, jackpot = default_jackpot, updated_at = now()
    where id = g.id;
  return draw;
end $$;

-- "removes all tickets from both lotteries but does not change player gold balances or delete past-winner history"
create function public.admin_delete_all_lottery_tickets() returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  n bigint;
begin
  perform public.require_lottery_admin();
  delete from public.lottery_tickets where true;
  get diagnostics n = row_count;
  return n;
end $$;

-- "deletes all tickets and winner history and restores both jackpots to their defaults"
create function public.admin_reset_lottery_data() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g record;
  draw bigint;
begin
  perform public.require_lottery_admin();
  delete from public.lottery_tickets where true;
  delete from public.draw_history where true;
  for g in select id from public.lottery_games order by id for update loop
    insert into public.lottery_draws (lottery_id) values (g.id) returning id into draw;
    update public.lottery_games set current_draw_id = draw, sales_open = true, draw_at = null, jackpot = default_jackpot, updated_at = now()
      where id = g.id;
  end loop;
end $$;

-- ---------- who may call what ----------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_lottery_admin() to anon, authenticated;
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
  public.admin_reset_lottery_data()
to authenticated;

-- ---------- the two games ----------

insert into public.lottery_games (id, name, jackpot, default_jackpot, ticket_price) values
  ('mini', 'Mini Lottery', 0, 0, 10),
  ('grand', 'Grand Lottery', 500, 500, 50);
insert into public.lottery_draws (lottery_id) select id from public.lottery_games;
update public.lottery_games g set current_draw_id = d.id from public.lottery_draws d where d.lottery_id = g.id;
