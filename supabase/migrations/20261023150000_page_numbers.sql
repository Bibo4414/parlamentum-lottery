-- Numbers the redesigned pages show.

/** How full each open draw is: tickets sold, how many players hold them, and the fees they paid. For the organizer
 *  only (players see the pool and their own tickets): it tells whether a draw covers its seed. */
create function public.admin_draw_stats()
returns table (lottery_id text, draw_id bigint, tickets int, players int, fees bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_lottery_admin();
  return query
    select g.id, g.current_draw_id, count(t.id)::int, count(distinct t.user_id)::int,
           coalesce((select sum(p.fee) from public.ticket_purchases p where p.draw_id = g.current_draw_id and p.refunded_at is null), 0)::bigint
    from public.lottery_games g left join public.lottery_tickets t on t.draw_id = g.current_draw_id
    group by g.id, g.current_draw_id;
end $$;

/** What the House holds and owes, for the organizer: every balance, the withdrawals waiting to be paid and the ticket
 *  money in the open pools are the players' gold; the seeds in the pools are the House's own, promised to winners. */
create function public.admin_house_numbers()
returns table (balances bigint, pending_withdrawals bigint, ticket_gold bigint, seed_gold bigint, owed_to_players bigint, fees bigint, mismatches int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  b bigint; w bigint; t bigint; pools bigint; f bigint; m int;
begin
  perform public.require_lottery_admin();
  select coalesce(sum(gold), 0) into b from public.player_profiles;
  select coalesce(sum(amount), 0) into w from public.withdrawal_requests where status = 'pending';
  select coalesce(sum(tk.price_paid), 0) into t from public.lottery_games g join public.lottery_tickets tk on tk.draw_id = g.current_draw_id;
  select coalesce(sum(jackpot), 0) into pools from public.lottery_games;
  select coalesce(sum(fee), 0) into f from public.ticket_purchases where refunded_at is null;
  select count(*)::int into m from public.gold_mismatches();
  return query select b, w, t, greatest(pools - t, 0), b + w + t, f, m;
end $$;

revoke execute on function public.admin_draw_stats(), public.admin_house_numbers() from public, anon, authenticated;
grant execute on function public.admin_draw_stats(), public.admin_house_numbers() to authenticated;
