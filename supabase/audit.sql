-- Read-only checks of the live project. Paste into Supabase → SQL Editor → Run. It changes nothing.
-- Each row is one finding: 'ok', 'check' (look at it) or 'fix' (a hole). Send the result to whoever reviews it.
-- Part 2 at the bottom prints the live definitions, so the migrations in supabase/migrations can be compared with them.

with lottery_tables as (
  select c.oid, c.relname, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
funcs as (
  select p.oid, p.proname, p.prosecdef as definer, pg_get_function_identity_arguments(p.oid) as args,
         coalesce(array_to_string(p.proconfig, ','), '') as config, pg_get_functiondef(p.oid) as body,
         has_function_privilege('anon', p.oid, 'execute') as anon_can, has_function_privilege('authenticated', p.oid, 'execute') as auth_can
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
findings as (
  -- 1. every table needs row-level security, or the publishable key can read and write it directly
  select case when rls then 'ok' else 'fix' end as status, 'row-level security' as area,
         relname || case when rls then ' has RLS on' else ' has RLS OFF: anyone with the page''s key can read/write it' end as finding
  from lottery_tables
  union all
  -- 2. write policies for players on tables that hold gold, tickets, pools or draws: these should not exist
  select 'fix', 'write policy', format('%s: policy "%s" lets %s %s rows (%s)', tablename, policyname, array_to_string(roles, ','), cmd, coalesce(qual, with_check, 'true'))
  from pg_policies
  where schemaname = 'public' and cmd <> 'SELECT'
    and tablename in ('player_profiles', 'lottery_games', 'lottery_tickets', 'draw_history', 'withdrawal_requests', 'deposit_requests', 'lottery_draws', 'ticket_purchases', 'gold_moves', 'lottery_admins')
  union all
  -- 3. read policies: worth a look (profiles and requests should be own-row or organizer only)
  select 'check', 'read policy', format('%s: "%s" for %s using (%s)', tablename, policyname, array_to_string(roles, ','), coalesce(qual, 'true'))
  from pg_policies where schemaname = 'public' and cmd in ('SELECT', 'ALL')
  union all
  -- 4. table privileges: insert/update/delete granted to the page's roles (RLS is the only thing left in the way)
  select 'check', 'table grant', format('%s can %s on %s', grantee, string_agg(privilege_type, ','), table_name)
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  group by grantee, table_name
  union all
  -- 5. organizer functions must check the organizer inside, not just in the page
  select case when body ~* 'is_lottery_admin|require_lottery_admin|lottery_admins' then 'ok' else 'fix' end, 'organizer check',
         proname || '(' || args || ')' || case when body ~* 'is_lottery_admin|require_lottery_admin|lottery_admins' then ' checks the organizer' else ' does NOT check the organizer: any logged-in player can call it' end
  from funcs where proname like 'admin\_%'
  union all
  -- 6. security-definer functions need a fixed search_path
  select case when config like '%search_path%' then 'ok' else 'fix' end, 'search_path',
         proname || '(' || args || ')' || case when config like '%search_path%' then ' sets search_path' else ' is SECURITY DEFINER without search_path' end
  from funcs where definer
  union all
  -- 7. what visitors who never logged in can call
  select 'check', 'anon can call', proname || '(' || args || ')' from funcs where anon_can and proname not in ('is_lottery_admin', 'draw_tickets')
  union all
  -- 8. how the winner is picked
  select case when body ~* 'random\(\)' then 'fix' else 'check' end, 'draw randomness',
         proname || case when body ~* 'random\(\)' then ' picks with random(): not cryptographic, and nobody can check it afterwards' else ' (read the body below)' end
  from funcs where proname = 'admin_close_and_draw'
  union all
  -- 9. who the organizer is
  select 'check', 'organizer', 'is_lottery_admin: ' || regexp_replace(body, '\s+', ' ', 'g') from funcs where proname = 'is_lottery_admin'
  union all
  -- 10. the gold itself
  select case when count(*) filter (where gold < 0) > 0 then 'fix' else 'ok' end, 'balances',
         format('%s players hold %s gold in total; %s below zero', count(*), coalesce(sum(gold), 0), count(*) filter (where gold < 0))
  from public.player_profiles
  union all
  select case when count(*) > 0 then 'fix' else 'ok' end, 'usernames',
         format('%s usernames clash ignoring case', count(*))
  from (select lower(username) from public.player_profiles group by 1 having count(*) > 1) clash
  union all
  select 'check', 'pending', format('%s withdrawals (%s gold) and %s deposit requests (%s gold) waiting',
         (select count(*) from public.withdrawal_requests where status = 'pending'), (select coalesce(sum(amount), 0) from public.withdrawal_requests where status = 'pending'),
         (select count(*) from public.deposit_requests where status = 'pending'), (select coalesce(sum(amount), 0) from public.deposit_requests where status = 'pending'))
)
select * from findings order by case status when 'fix' then 0 when 'check' then 1 else 2 end, area, finding;

-- Part 2 (run on its own): the live definitions, for comparing with supabase/migrations.
-- select table_name, string_agg(column_name || ' ' || data_type || case when is_nullable = 'NO' then ' not null' else '' end, ', ' order by ordinal_position)
--   from information_schema.columns where table_schema = 'public' group by table_name order by table_name;
-- select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname;
-- select tgname, pg_get_triggerdef(t.oid) from pg_trigger t where not tgisinternal and tgrelid = 'auth.users'::regclass;
