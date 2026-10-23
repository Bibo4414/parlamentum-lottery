## Profitability

The lottery is a raffle, not a numbers game. Each ticket's price goes into its raffle's pool, and a 10% fee on top goes
to the House. One ticket drawn at random wins the whole pool, and the draw then opens the next one, which starts at the
raffle's seed. Since commit e48c442 the Mini has no seed and the Grand's is 500 gold, paid by the House. The House
never bets against players. Its result on a draw is **fees − seed**, which depends only on how many tickets sold, not
on who wins.

So the Mini is now pure fee income: every draw with at least one ticket earns the House 1 gold a ticket and can't lose.
**All of the House's losses are on the Grand.** Before e48c442 the Mini's seed was 100 and it lost below 100 tickets a
draw exactly like the Grand. At 30 tickets a draw in each raffle the House then expected −43,436 a year; it expects
−33,077 now.

All figures come from `scripts/odds.mjs`. Run `node scripts/odds.mjs`; `--help` lists the settings, and each one
defaults to today's value. The script is exact where it can be and is checked by a seeded simulation. The House's real
tax rates aren't known, so 10% (a new state's default) is used unless a table says otherwise.

### One draw

The Mini pays out only the ticket prices: in every draw, players get back 90.9% of what they pay and the House keeps
9.1%. The Grand breaks even at **100 tickets a draw**, because its seed equals the fees on 100 tickets (5,000 gold of
tickets). Below that, Grand players are ahead on average and the House pays the difference out of its own gold.

| Tickets in the draw | 5 | 10 | 20 | 50 | 100 | 200 | 500 | 1,000 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| House, Mini draw (no seed) | +5 | +10 | +20 | +50 | +100 | +200 | +500 | +1,000 |
| House, Grand draw | −475 | −450 | −400 | −250 | 0 | +500 | +2,000 | +4,500 |
| A Grand ticket's value (it costs 55) | +95.00 | +45.00 | +20.00 | +5.00 | 0 | −2.50 | −4.00 | −4.50 |
| Grand players get back | 272.7% | 181.8% | 136.4% | 109.1% | 100% | 95.5% | 92.7% | 91.8% |
| Grand House edge | −172.7% | −81.8% | −36.4% | −9.1% | 0 | 4.5% | 7.3% | 8.2% |

A Grand ticket is worth the pool ÷ tickets minus its cost, which works out to 500 ÷ tickets minus the 5-gold fee. The
House's edge can never pass 9.1% (the fee's share of price plus fee): the Mini sits at exactly that in every draw, and
the Grand only gets close in very large draws. Today's prices are multiples of 10, so rounding the fee up per purchase
changes nothing. At a price of 7, single tickets would pay a 14.3% fee.

### Thin Grand draws are where the gold goes

A player alone in a Grand draw wins the pool, seed included: one ticket costs 55 and wins 550 (+495). Alone in a Mini
draw, a buyer only gets their own ticket prices back (10 for 11), so there is nothing to take there any more. The menu
shows both pools to anyone, so the ticket count of every draw is public ((pool − seed) ÷ price), and a player can
wait for a thin Grand draw.

| Single Grand tickets bought by others | 0 | 3 | 10 | 30 | 90 |
|---|--:|--:|--:|--:|--:|
| A 10-ticket buyer's chance to win | 100% | 76.9% | 50% | 25% | 10% |
| Their expected profit | +450 | +334.6 | +200 | +75 | 0 |
| Best number to buy, and its profit | 1: +495 | 14: +341.8 | 22: +233.8 | 25: +102.3 | 5: +1.3 |

Everyone in a thin Grand draw comes out ahead on average, small buyers included, and their gains add up to exactly the
House's loss.

### A year of draws

This assumes two draws a week of each raffle (104 a year), with both raffles selling the same average and a 5,000-gold
bankroll at the start. Demand is lumpy: a negative binomial with k = 2, so a draw's ticket count varies by about 70% of
its average. Steady (Poisson) demand gives nearly the same averages with a much smaller spread.

| Tickets a draw, each raffle | Mini a year | Grand a year | Together | 90% of years end between | Bankroll gone |
|---|--:|--:|--:|---|---|
| 10 | +1,040 | −45,356 | −44,316 | −45,615 and −42,832 | every year, around week 6 |
| 30 | +3,120 | −36,197 | −33,077 | −34,927 and −31,101 | every year, around week 8 |
| 60 | +6,240 | −20,746 | −14,506 | −18,087 and −10,674 | every year, around week 18 |
| 100 | +10,400 | +20 | +10,420 | +4,491 and +16,630 | under 0.1% of years |
| 200 | +20,800 | +52,005 | +72,805 | +60,954 and +85,381 | never |

The Mini earns 104 gold a year for each ticket of average demand. That covers a small part of the Grand's loss, which
is up to 500 gold a draw. If the Grand sells fewer tickets than the Mini, as its price suggests, it loses more per
draw, not less: 450 gold at 10 tickets.

The bankroll is the House's own gold. Separately, the House holds the players' gold: every balance, every pending
withdrawal and the ticket gold in both pools. That is owed whatever the draws do, yet today the organizer page shows
only fee earnings.

### Gold in and out

**Deposits.** A player buys Raw Copper from the House at 1.05 and is credited 1 gold a unit. The House gets 1.05 less
its export tax, so it loses on every deposit unless that tax is under 4.76%. It also hands over one Raw Copper for each
gold it credits, worth about 0.08 gold on the 17 October market.

| House export tax | 0% | 5% | 10% | 15% | 20% |
|---|--:|--:|--:|--:|--:|
| Margin per gold at 1.05 | +0.0500 | −0.0025 | −0.0550 | −0.1075 | −0.1600 |
| … counting the copper | −0.0300 | −0.0825 | −0.1350 | −0.1875 | −0.2400 |
| Break-even price (tax only) | 1.00 | 1.06 | 1.12 | 1.18 | 1.25 |
| Price that also covers the copper, 1 gold a unit | 1.08 | 1.14 | 1.20 | 1.28 | 1.35 |
| … with one Raw Copper per 10 gold credited | 10.08 | 10.62 | 11.20 | 11.86 | 12.60 |

Break-even is 1 ÷ (1 − export tax), rounded up to the hundredth. That confirms 1.06 at 5% and 1.12 at 10% (1.0526 and
1.1111 before rounding), which leave margins of 0.007 and 0.008 a gold.

**Withdrawals.** The player lists Raw Copper for X and the House buys it, paying X plus its import tax: 5 or 10 gold
extra on every 100 withdrawn. If the player lists at X ÷ (1 + import tax) instead, rounded down to the hundredth (95.23
per 100 at 5%, 90.90 at 10%), the House pays at most X.

**A round trip.** Depositing 100 gold at 1.05 and withdrawing it without playing costs the House on both legs:

| House taxes, export / import | House receives | House pays | Result | Copper handed over |
|---|--:|--:|--:|--:|
| 5% / 5% | 99.75 | 105.00 | −5.25 | −7.92 |
| 10% / 10% | 94.50 | 110.00 | −15.50 | −7.92 |

A player taxed at the same rates loses on it too (7.33 and 17.58, copper kept), so it isn't a way to farm gold. But the
House pays these costs on every deposit and every withdrawal, winnings included, and anyone can repeat them. With both
fixes, the same round trip leaves the House +0.71 and +0.81, before the copper.

### Other ways to run it

Every row uses the same lumpy demand over a year, with both raffles together and the rule applied to both. With no seed,
the Mini earns its fees under every rule, so the differences come from the Grand, except in the last row. The today,
(a) and (c) rows are exact; the rest are simulated.

| Rule | House a year, 10 tickets a draw | 30 tickets | 100 tickets | Grand players get back (30) | Grand draws a year (30) |
|---|--:|--:|--:|--:|--:|
| Today | −44,316 | −33,077 | +10,420 | 121.1% | 104 |
| (a) Seed = 50% of the last draw's fees, at most 500 | +3,666 | +10,946 | +37,890 | 95.4% | 104 |
| (b) Draw only with 20+ tickets | −12,669 | −17,460 | +13,538 | 112.0% | 72 |
| (b) Draw only with 100+ tickets | +1,403 | +5,990 | +32,778 | 98.3% | 25 |
| (c) Rollover, numbers 1 to 200 | +3,640 | +10,920 | +34,347 | 95.5% | 16 winners |
| (c) Rollover, numbers 1 to 500 | +5,200 | +15,600 | +51,985 | 92.7% | 6 winners |
| Recommended: (a), and a draw waits until its fees cover its seed | +3,657 | +10,941 | +38,463 | 95.4% | 66 (103 if demand is steady) |
| Recommended, plus a Mini seed from its own fees (at most 100) | +3,154 | +9,400 | +33,686 | 95.4% (Mini 95.4%) | 66 (Mini 67) |

- **(a) Seeds from fees.** Each Grand seed is paid out of fees already earned, so the House can lose no more than the
  500 in the pool today, at any demand. Grand players get back about 95.4% (the ticket prices plus half the fees) while
  the cap isn't reached.
- **(b) A minimum ticket count.** A draw waits for the next draw time, its pool still growing, until it has enough
  tickets. Any minimum below the Grand's break-even of 100 only slows the losses. At 100 the House can't lose and the
  pool keeps its 500 headline, but at 30 tickets a draw the Grand draws only about every two weeks. A minimum number of
  *different players* doesn't help on its own: three players with one ticket each still share the 500-gold seed for 15
  gold of fees.
- **(c) Rollover.** The winning number is drawn from 1 to R, and the pool rolls over when no ticket holds it. The House
  earns at any demand, and a won Grand pool averages 10,500 at R = 200. But winners come rarely when demand is low
  (every 6.7 draws at 30 tickets with R = 200), and it changes the draw that the security pass made checkable.

### Recommended settings

1. **Mini: keep the seed at 0.** Each Mini draw earns the House its fees, can't lose, and has nothing to snipe. A seed
   paid from its own fees (half of them, at most 100) would raise Mini players' return from 90.9% to 95.4%, still at
   no risk. But it costs half the Mini's income (about 1,540 a year at 30 tickets a draw), and under the Grand's
   minimum rule (rule 3) a third of Mini draw times would be pushed back with lumpy demand. It's only worth it if an
   empty starting pool visibly hurts sales.
2. **Grand seed: half the fees the last Grand draw took, at most 500.** Today each draw resets the pool to a fixed 500
   (`default_jackpot`). Paying the seed out of fees already earned means no level of demand can make the Grand cost the
   House more than the 500 in its pool now.
3. **Grand minimum: at its announced time, a Grand draw goes ahead only if its fees cover its seed; otherwise it is
   announced for the next slot, with its tickets and pool carried over.** With rule 2 that's half the previous draw's
   tickets (15 after a 30-ticket draw). No draw then costs the House gold, buying into a thin draw stops paying, and
   no draw happens before its announced time. If the 500 headline matters more than how often the Grand draws, keep 500
   and require 100 tickets instead (row (b) 100). That also can't lose, but at 30 tickets a draw the Grand earns
   about 2,870 a year that way, against 7,820.
4. **Fee: keep 10% on top, rounded up per purchase, and keep ticket prices at multiples of 10.** The fee is the House's
   only income and players already know it. The seed share, not the fee, decides how much goes back to players, and
   multiples of 10 keep the rounding exact.
5. **Deposit price: 1.06 a gold at a 5% export tax, 1.12 at 10%, sold as one Raw Copper per 10 gold credited (10.62 or
   11.20 a unit).** 1.06 and 1.12 are the lowest prices that cover the tax. The 10-gold unit cuts the copper handed over
   from 0.08 to 0.008 a gold. If the unit stays at 1 gold, the prices that cover the copper are 1.14 and 1.20.
6. **Withdrawals: the player lists one Raw Copper at X ÷ (1 + the House's import tax), rounded down to the hundredth
   (X ÷ 1.05 or X ÷ 1.10).** The House then pays X, not X plus 5–10%.
7. **Show "owed to players" (all balances + pending withdrawals + the ticket gold in both pools), and keep that plus the
   Grand's current seed in the game.** That gold belongs to the players, not to the House.

With rules 1 to 3 at 30 tickets a draw in each raffle, the House makes about +10,900 a year instead of losing 33,077.
Mini players get back 90.9% of what they pay and Grand players 95.4%. With lumpy demand about one Grand draw time in
three is pushed back (66 draws a year instead of 104); with steady demand almost none are (103). The organizer's "Set
prize pool" control can't take a pool below what players paid in, and anything set above that comes out of the
House's own gold. Once the House's real tax rates are known, re-run the script with `--export-tax` and
`--import-tax`.
