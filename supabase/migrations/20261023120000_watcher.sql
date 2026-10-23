-- The watcher: deposits credit themselves, by the buyer's name in the game.
--
-- An edge function (supabase/functions/watcher) reads the House's own side of Parlamentum with the House's game login
-- and hands what it saw to watcher_record() below. Each Raw Copper sale on the global market at the deposit price is
-- credited to the lottery account with the buyer's name, and each accepted contract that sends the House gold for
-- Raw Copper to the account of its sender: what the House really received (the trade's total less the game's tax),
-- in whole gold, once. A deposit request the player made is settled by the trade at what was really paid. One game
-- trade pays one ledger line, and the database itself keeps it that way.
--
-- The login is sealed by the edge function with WATCHER_SEAL_KEY before it gets here, and nothing here hands it back
-- to a client: watcher_state has no policy at all.

-- ---------- settings the organizer controls ----------

create table public.lottery_settings (
  id int primary key default 1 check (id = 1),
  house_name text not null default 'Bibo4414' check (length(house_name) between 1 and 40),
  deposit_item text not null default 'COPPER_RAW' check (deposit_item ~ '^[A-Z0-9_]{2,40}$'),
  deposit_item_label text not null default 'Raw Copper' check (length(deposit_item_label) between 1 and 40),
  deposit_tier text check (deposit_tier ~ '^T[0-9]{1,2}$'),
  deposit_price_cents int not null default 105 check (deposit_price_cents between 1 and 1000000),
  export_tax_pct numeric(4, 1) not null default 10 check (export_tax_pct between 0 and 50),
  import_tax_pct numeric(4, 1) not null default 0 check (import_tax_pct between 0 and 50),
  updated_at timestamptz not null default now()
);
insert into public.lottery_settings (id) values (1);
alter table public.lottery_settings enable row level security;
revoke all on public.lottery_settings from anon, authenticated;
grant select on public.lottery_settings to anon, authenticated;
create policy "deposit terms are public" on public.lottery_settings for select using (true);

-- ---------- the watcher's own state: the House's only ----------

create table public.watcher_state (
  id int primary key default 1 check (id = 1),
  token_sealed text,
  token_exp timestamptz,
  since timestamptz,
  house_id text,
  checked_at timestamptz,
  ok_at timestamptz,
  error text,
  listing jsonb,
  updated_at timestamptz not null default now()
);
insert into public.watcher_state (id) values (1);
alter table public.watcher_state enable row level security;
revoke all on public.watcher_state from anon, authenticated;

-- every deposit-shaped trade the watcher saw, by the game's own id: open until settled; 'deposit' once it paid a
-- ledger line (or was found already paid by hand); 'other' when nobody here can claim it (logged, never paid later
-- by itself); 'old' when it happened before the watcher was first turned on (the organizer's to credit by hand)
create table public.game_sales (
  id text primary key check (id ~ '^(trade|contract):.{1,80}$'),
  kind text not null check (kind in ('market', 'contract')),
  at timestamptz not null,
  units bigint,
  gross_cents bigint not null check (gross_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  gold bigint not null check (gold >= 0),
  name text not null,
  state text not null default 'open' check (state in ('open', 'deposit', 'other', 'old')),
  reason text,
  user_id uuid references public.player_profiles (user_id),
  deposit_request_id bigint references public.deposit_requests (id),
  seen_at timestamptz not null default now(),
  settled_at timestamptz
);
create index game_sales_open on public.game_sales (at) where state = 'open';
create index game_sales_recent on public.game_sales (at desc);
alter table public.game_sales enable row level security;
revoke all on public.game_sales from anon, authenticated;
grant select on public.game_sales to authenticated;
create policy "the organizer sees the trades" on public.game_sales for select to authenticated using ((select public.is_lottery_admin()));

-- one game trade pays one ledger line, whether the watcher paid it or found it paid by hand
alter table public.gold_moves add column game_sale text references public.game_sales (id);
create unique index gold_moves_one_line_per_trade on public.gold_moves (game_sale) where game_sale is not null;
alter table public.deposit_requests add column game_sale text references public.game_sales (id);
create unique index deposit_requests_one_per_trade on public.deposit_requests (game_sale) where game_sale is not null;

-- move_gold learns which game trade a line is paid from
drop function public.move_gold(uuid, bigint, text, text, text);
create function public.move_gold(p_user uuid, p_delta bigint, p_kind text, p_ref text default null, p_note text default null, p_game_sale text default null)
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
  insert into public.gold_moves (user_id, delta, kind, ref, note, actor, game_sale) values (p_user, p_delta, p_kind, p_ref, p_note, auth.uid(), p_game_sale);
  return balance;
end $$;
revoke execute on function public.move_gold(uuid, bigint, text, text, text, text) from public, anon, authenticated;

-- ---------- settling ----------

/** Is the watcher crediting right now: a login set, and a good look within the last day. */
create function public.watcher_live() returns boolean
language sql stable security definer set search_path = ''
as $$ select token_sealed is not null and error is null and ok_at > now() - interval '1 day' from public.watcher_state where id = 1 $$;

/** Pays one open trade, or files it. Internal: the caller holds the trade's row. */
create function public.settle_game_sale(p_sale public.game_sales, p_request bigint default null) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  who record;
  hand bigint;
  req public.deposit_requests;
  what text;
begin
  select p.user_id, exists (select 1 from public.lottery_admins a where a.user_id = p.user_id) as organizer into who
    from public.player_profiles p where lower(p.username) = lower(p_sale.name);
  if not found or who.organizer or p_sale.gold < 1 then
    update public.game_sales
      set state = 'other', settled_at = now(),
          reason = case when not found then 'no lottery account has this name' when who.organizer then 'an organizer account' else 'less than 1 gold after the game''s tax' end
      where id = p_sale.id;
    return 'other';
  end if;

  -- paid by hand already (the watcher was off, say)? that line is linked to the trade instead of paying twice
  select m.id into hand from public.gold_moves m
    where m.user_id = who.user_id and m.kind in ('credit', 'deposit') and m.game_sale is null and m.delta > 0
      and (m.delta = p_sale.gold or m.delta = p_sale.units) and m.created_at >= p_sale.at - interval '1 hour'
    order by m.created_at limit 1 for update;
  if found then
    update public.gold_moves set game_sale = p_sale.id where id = hand;
    update public.game_sales set state = 'deposit', reason = 'paid by hand', user_id = who.user_id, settled_at = now() where id = p_sale.id;
    return 'by hand';
  end if;

  -- the player's deposit request, if they made one: the given one, else the one of this amount, else the oldest
  select * into req from public.deposit_requests r
    where r.user_id = who.user_id and r.status = 'pending' and (p_request is null or r.id = p_request)
    order by (r.amount = p_sale.gold or r.amount = p_sale.units) desc, r.id limit 1 for update;
  if found then
    update public.deposit_requests set status = 'approved', processed_at = now(), game_sale = p_sale.id where id = req.id;
  end if;

  what := case when p_sale.kind = 'market' then 'bought ' || p_sale.units || ' units for ' || to_char(p_sale.gross_cents / 100.0, 'FM999999990.00') || ' gold'
               else 'sent ' || to_char(p_sale.gross_cents / 100.0, 'FM999999990.00') || ' gold by contract' end;
  perform public.move_gold(who.user_id, p_sale.gold, 'deposit', p_sale.id, what || case when req.id is not null then ' (request #' || req.id || ')' else '' end, p_sale.id);
  update public.game_sales set state = 'deposit', user_id = who.user_id, deposit_request_id = req.id, settled_at = now() where id = p_sale.id;
  return 'credited';
end $$;

/** What the edge function saw in one look: remembers each trade once and settles every open one. Service role only. */
create function public.watcher_record(p_house_id text, p_sales jsonb, p_listing jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  w public.watcher_state;
  s public.game_sales;
  result text;
  tally jsonb := '{}'::jsonb;
begin
  select * into w from public.watcher_state where id = 1;
  insert into public.game_sales (id, kind, at, units, gross_cents, tax_cents, gold, name, state)
    select x.id, x.kind, x.at, x.units, x.gross_cents, x.tax_cents, x.gold, x.name,
           case when x.at < coalesce(w.since, now()) then 'old' else 'open' end
    from jsonb_to_recordset(coalesce(p_sales, '[]'::jsonb))
      as x (id text, kind text, at timestamptz, units bigint, gross_cents bigint, tax_cents bigint, gold bigint, name text)
  on conflict (id) do nothing;

  for s in select * from public.game_sales where state = 'open' order by at, id for update skip locked loop
    -- one odd trade never stops the others; it stays open and is tried again on the next look
    begin
      result := public.settle_game_sale(s);
      tally := jsonb_set(tally, array[result], to_jsonb(coalesce((tally ->> result)::int, 0) + 1));
    exception when others then
      raise warning 'watcher: trade % not settled: %', s.id, sqlerrm;
    end;
  end loop;

  update public.watcher_state set house_id = p_house_id, ok_at = now(), error = null, listing = p_listing, updated_at = now() where id = 1;
  return tally;
end $$;

/** Takes the next look, if a minute has passed since the last one (or at once, forced): one statement, so parallel
 *  triggers look once. Returns the sealed login and the deposit terms, or nothing. Service role only. */
create function public.watcher_claim(p_force boolean)
returns table (token_sealed text, house_id text, item text, tier text, price_cents int, export_tax_pct numeric)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
    with c as (
      update public.watcher_state w set checked_at = now()
      where w.id = 1 and w.token_sealed is not null and (p_force or w.checked_at is null or w.checked_at < now() - interval '60 seconds')
      returning w.token_sealed, w.house_id
    )
    select c.token_sealed, c.house_id, s.deposit_item, s.deposit_tier, s.deposit_price_cents, s.export_tax_pct
    from c cross join public.lottery_settings s where s.id = 1;
end $$;

create function public.watcher_fail(p_error text) returns void
language sql security definer set search_path = ''
as $$ update public.watcher_state set error = left(p_error, 500), updated_at = now() where id = 1 $$;

/** The House's login, sealed by the edge function, or (null) the watcher stops. Trades from before the first login
 *  stay the organizer's to credit by hand. Service role only. */
create function public.watcher_set_login(p_sealed text, p_exp timestamptz) returns void
language sql security definer set search_path = ''
as $$
  update public.watcher_state
    set token_sealed = p_sealed, token_exp = case when p_sealed is null then null else p_exp end,
        since = case when p_sealed is null then since else coalesce(since, now()) end,
        house_id = null, checked_at = null, error = null, updated_at = now()
    where id = 1
$$;

-- ---------- the organizer ----------

/** What the organizer sees: on or off and why, the login's end, the deposit listing, and the latest trades.
 *  Never the login itself. */
create function public.admin_watcher_status() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  w public.watcher_state;
begin
  perform public.require_lottery_admin();
  select * into w from public.watcher_state where id = 1;
  return jsonb_build_object(
    'on', w.token_sealed is not null,
    'error', case when w.token_sealed is not null then w.error end,
    'ok_at', w.ok_at, 'checked_at', w.checked_at, 'login_ends', w.token_exp, 'since', w.since, 'listing', w.listing,
    'sales', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.at desc, x.id) from (
        select g.id, g.kind, g.at, g.units, g.gross_cents, g.tax_cents, g.gold, g.name, g.state, g.reason, g.deposit_request_id
        from public.game_sales g where g.state <> 'old' order by g.at desc, g.id limit 30
      ) x), '[]'::jsonb)
  );
end $$;

create function public.admin_set_deposit_terms(p_house_name text, p_item text, p_item_label text, p_tier text, p_price_cents int, p_export_tax_pct numeric, p_import_tax_pct numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  update public.lottery_settings
    set house_name = btrim(p_house_name), deposit_item = upper(btrim(p_item)), deposit_item_label = btrim(p_item_label),
        deposit_tier = nullif(upper(btrim(coalesce(p_tier, ''))), ''), deposit_price_cents = p_price_cents,
        export_tax_pct = p_export_tax_pct, import_tax_pct = p_import_tax_pct, updated_at = now()
    where id = 1;
end $$;

-- approving a deposit request by hand while the watcher runs: the game is checked first, so nothing is paid twice
drop function public.admin_process_deposit(bigint, boolean);
create function public.admin_process_deposit(p_request_id bigint, p_approve boolean, p_force boolean default false) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.deposit_requests;
  sale public.game_sales;
  player_name text;
begin
  perform public.require_lottery_admin();
  select * into r from public.deposit_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'That deposit was already handled.'; end if;
  select username into player_name from public.player_profiles where user_id = r.user_id;

  if p_approve and public.watcher_live() then
    -- a trade of this player the watcher saw and hasn't paid yet: pay from it now
    select * into sale from public.game_sales
      where state = 'open' and lower(game_sales.name) = lower(player_name) and (gold = r.amount or units = r.amount) order by at limit 1 for update;
    if found then
      perform public.settle_game_sale(sale, r.id);
      return 'paid from the game trade';
    end if;
    -- one the watcher already paid: approving would pay the same gold twice
    select * into sale from public.game_sales
      where state = 'deposit' and lower(game_sales.name) = lower(player_name) and (gold = r.amount or units = r.amount)
        and at >= r.created_at - interval '2 days' and deposit_request_id is distinct from r.id
      order by at desc limit 1;
    if found then
      raise exception 'The watcher already credited % gold to % for a trade on % UTC. Approving would pay it twice: reject this request.',
        sale.gold, player_name, to_char(sale.at at time zone 'UTC', 'YYYY-MM-DD HH24:MI');
    end if;
    if not p_force then
      raise exception 'NO_TRADE: The watcher hasn''t seen a trade of % gold from % yet. Approve anyway?', r.amount, player_name;
    end if;
  end if;

  update public.deposit_requests
    set status = case when p_approve then 'approved' else 'rejected' end, processed_at = now(), processed_by = auth.uid()
    where id = r.id;
  if p_approve then
    perform public.move_gold(r.user_id, r.amount, 'deposit', 'deposit_request:' || r.id, 'approved by hand');
    return 'approved by hand';
  end if;
  return 'rejected';
end $$;

-- ---------- what players see ----------

/** The deposit terms and whether deposits land by themselves right now. */
create function public.deposit_info() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'house_name', s.house_name, 'item', s.deposit_item, 'item_label', s.deposit_item_label, 'tier', s.deposit_tier,
    'price_cents', s.deposit_price_cents, 'export_tax_pct', s.export_tax_pct, 'import_tax_pct', s.import_tax_pct,
    'automatic', coalesce(public.watcher_live(), false))
  from public.lottery_settings s where s.id = 1
$$;

-- ---------- who may call what ----------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_lottery_admin(), public.draw_tickets(bigint), public.deposit_info() to anon, authenticated;
grant execute on function
  public.buy_lottery_tickets(int, text),
  public.request_lottery_withdrawal(bigint),
  public.request_lottery_deposit(bigint),
  public.admin_credit_gold(text, bigint),
  public.admin_process_withdrawal(bigint, boolean),
  public.admin_process_deposit(bigint, boolean, boolean),
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
  public.gold_mismatches(),
  public.admin_watcher_status(),
  public.admin_set_deposit_terms(text, text, text, text, int, numeric, numeric)
to authenticated;
