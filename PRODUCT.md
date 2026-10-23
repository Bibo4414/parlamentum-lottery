# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Players of Parlamentum, a browser game in which players run countries: politics, economy, markets and war. They hold in-game gold and come here to put some of it into a raffle, check whether they won, and move gold in and out. They open it on phones and desktops about equally, usually alongside the game itself.

The organizer runs it: approves or checks deposits, pays withdrawals in the game, schedules and draws the raffles, and watches the House's numbers.

## Product Purpose

Two community raffles paid in Parlamentum gold, with one shared balance: the Mini (10 gold a ticket) and the Grand (50 gold a ticket, with a pool the House seeds). One ticket wins each draw's whole pool, paid to the winner's balance automatically, and the next draw opens at once.

Success: players trust it. Deposits land, draws are fair and can be checked, withdrawals get paid. The organizer can run it in a few minutes a day.

## Positioning

A Parlamentum raffle whose deposits credit themselves from the game's own trade ledger, whose every draw can be checked by anyone (the seed's fingerprint is published before the draw, the seed and the ticket list after it), and whose gold is all on a ledger.

## Operating Context

- Gold comes in when a player buys Raw Copper from the House on the game's global market at the deposit price; the watcher credits what the House receives after the game's tax, in whole gold. Accepted gold-for-copper contracts count too. Players can also tell the organizer about a deposit.
- Gold goes out when a player asks to withdraw: the gold is held, the player lists Raw Copper on the global market, and the organizer buys it in the game.
- Draws happen at announced UTC times, never earlier; tickets sell 1 to 10 at a time with a 10% organizer fee on top.
- The organizer works from the same site, signed in with an organizer account.

## Capabilities and Constraints

- Static site on GitHub Pages, built with Vite and TypeScript; Supabase holds accounts, balances and draws; an edge function runs the watcher.
- Whole gold only. Up to three deposit requests and three withdrawals waiting per player. Organizer accounts can't buy tickets.
- Accounts are a username and password (a real e-mail is optional).
- Undecided: the Grand's seed policy and a minimum number of tickets per draw (see docs/profitability.md); the House's real tax rates.

## Brand Commitments

- Name: Parlamentum Lottery ("The Lottery"), from the Parlamentum community.
- Voice: neutral. The page speaks as the lottery, and of "the organizer" and "the House", not in anyone's first person.
- Players see the pool and their own tickets; ticket counts, player counts and chances are not shown to players.
- Visual kinship with the game itself (its dark ground and gold) is part of the brief.

## Evidence on Hand

- No real draw history, player numbers or testimonials are available to this repository; don't invent any. The local seed (scripts/dev-seed.mjs) is test data and must not appear as real.
- Economics: docs/profitability.md and `npm run odds`.

## Product Principles

1. Trust is the product: show the mechanism (sealed draws, refunds, what a deposit credits) instead of asking for faith.
2. Honest money: every cost is visible before the click (ticket price, the fee, the tax a deposit loses), and nothing pressures a player to play.
3. Players and the organizer get separate places: the organizer's tools never sit in the players' way.
4. Works the same on a phone and on a desktop.

## Accessibility & Inclusion

No product-specific requirement was stated; the floor is WCAG 2.2 AA (contrast, keyboard, focus, 44 px touch targets).
