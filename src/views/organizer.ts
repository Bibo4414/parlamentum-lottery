// The organizer's page, in three tabs: requests (the House's numbers, what is waiting, adding gold by hand), draws
// (each raffle's controls, and the actions that can't be undone, kept apart) and the watcher. Only an organizer
// account gets here; the database checks every action anyway.
import { day, esc, fmt, goldOf, utc } from '../lib/format.ts';
import { icon } from '../lib/icons.ts';
import { LOTTERIES, LOTTERY_NAMES, state, type LotteryId, type WatchView } from '../state.ts';
import { badge, listInstruction, ticking } from './parts.ts';

export type OrganizerTab = 'requests' | 'draws' | 'watcher';

export function organizer(tab: OrganizerTab): string {
  if (!state.me?.organizer || !state.organizer) {
    return `<div class="page-head"><div><h1>Organizer</h1></div></div><section class="panel"><p class="empty">This page is for the organizer’s account.</p></section>`;
  }
  const o = state.organizer;
  const waiting = o.deposits.length + o.withdrawals.length;
  const watchAlert = !!o.watch?.on && (!!o.watch.error || watcherWarnings(o.watch).length > 0);
  const label: Record<OrganizerTab, string> = {
    requests: `Requests${waiting ? ` <span class="count">${fmt(waiting)}<span class="visually-hidden"> waiting</span></span>` : ''}`,
    draws: 'Draws',
    watcher: `Watcher${watchAlert ? ` <span class="count count-alert">${icon('warning')}<span class="visually-hidden">, needs you</span></span>` : ''}`,
  };
  const tabs = (['requests', 'draws', 'watcher'] as const).map((t) =>
    `<a href="#/organizer${t === 'requests' ? '' : `/${t}`}" ${t === tab ? 'aria-current="page"' : ''}>${label[t]}</a>`).join('');
  const body = tab === 'requests' ? `${houseNumbers()}${requests()}${creditByHand()}`
    : tab === 'draws' ? `${LOTTERIES.map(raffleControls).join('')}${dangerZone()}`
    : watcherPanel(o.watch);
  return `<div class="page-head"><div><h1>Organizer</h1></div>
    <button class="btn btn-ghost btn-sm" type="button" data-action="reload">${icon('refresh')}Refresh</button></div>
  <nav class="tabs" aria-label="Organizer">${tabs}</nav>
  <div class="grid">${body}</div>`;
}

function houseNumbers(): string {
  const h = state.organizer?.house;
  if (!h) return '';
  return `<section class="panel span-12" aria-labelledby="house-title"><div class="panel-head"><h2 id="house-title">${icon('landmark')}The House’s numbers</h2>
    ${h.mismatches ? badge(`${h.mismatches} balance${h.mismatches === 1 ? '' : 's'} off the ledger`, 'danger') : badge('Ledger adds up', 'credit')}</div>
    <dl class="facts">
      <div><dt>Owed to players</dt><dd class="gold">${fmt(h.owed_to_players)}</dd></div>
      <div><dt>Balances</dt><dd>${fmt(h.balances)}</dd></div>
      <div><dt>Withdrawals waiting</dt><dd>${fmt(h.pending_withdrawals)}</dd></div>
      <div><dt>Ticket gold in pools</dt><dd>${fmt(h.ticket_gold)}</dd></div>
      <div><dt>House seed in pools</dt><dd>${fmt(h.seed_gold)}</dd></div>
      <div><dt>Fees earned</dt><dd>${fmt(h.fees)}</dd></div>
    </dl>
    <p class="muted small facts-note">Keep at least the gold owed to players, plus the seeds, in the House’s account in the game.</p></section>`;
}

function requests(): string {
  const o = state.organizer!;
  const deposits = o.deposits.length
    ? `<table class="table stack"><thead><tr><th>Player</th><th class="right">Gold</th><th>Reported (UTC)</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>
      ${o.deposits.map((d) => `<tr><td><strong>${esc(d.username)}</strong></td><td class="num right">${fmt(d.amount)}</td><td>${esc(day(d.created_at))}</td>
        <td class="right" data-wide><div class="row-actions"><button class="btn btn-primary btn-sm" type="button" data-action="settle-deposit" data-id="${d.id}" data-approve="true">${icon('check')}Credit</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="settle-deposit" data-id="${d.id}" data-approve="false">Reject</button></div></td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">No deposit reports waiting.</p>';
  const withdrawals = o.withdrawals.length
    ? `<table class="table stack"><thead><tr><th>Player</th><th class="right">Gold</th><th>They list</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>
      ${o.withdrawals.map((w) => `<tr><td><strong>${esc(w.username)}</strong><br><span class="muted small">${esc(day(w.created_at))} UTC</span></td><td class="num right">${fmt(w.amount)}</td>
        <td>${esc(listInstruction(w.amount).replace(/^List /, ''))}</td>
        <td class="right" data-wide><div class="row-actions"><button class="btn btn-primary btn-sm" type="button" data-action="settle-withdrawal" data-id="${w.id}" data-paid="true">${icon('check')}Paid in the game</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="settle-withdrawal" data-id="${w.id}" data-paid="false">Reject and refund</button></div></td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">No withdrawals waiting.</p>';
  return `<section class="panel span-7" aria-labelledby="requests-title"><div class="panel-head"><h2 id="requests-title">${icon('hourglass')}Waiting for you</h2></div>
    <h3 class="label">Deposits players reported</h3>${deposits}
    <h3 class="label">Withdrawals to pay</h3>${withdrawals}
    <p class="muted small panel-note">A withdrawal is paid by buying the player’s listing in the game; mark it paid once you have.</p></section>`;
}

function creditByHand(): string {
  return `<section class="panel span-5" aria-labelledby="credit-title"><div class="panel-head"><h2 id="credit-title">${icon('coins')}Add gold by hand</h2></div>
    <form class="form" data-form="credit">
      <div class="field"><label for="credit-name">Player’s name</label><input class="input" id="credit-name" name="name" maxlength="24" autocomplete="off" required></div>
      <div class="field"><label for="credit-amount">Gold</label><input class="input input-num" id="credit-amount" name="amount" type="number" min="1" max="1000000" step="1" required></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Add gold</button></div>
      <p class="muted small">Every credit is written in the ledger with your name.${state.terms?.automatic ? ' The watcher credits deposit purchases by itself: check its trades on the Watcher tab before adding a deposit by hand.' : ''}</p>
    </form></section>`;
}

function raffleControls(id: LotteryId): string {
  const g = state.games[id];
  if (!g) return '';
  const name = LOTTERY_NAMES[id];
  const s = state.organizer?.stats.find((x) => x.lottery_id === id);
  const covers = s ? s.fees >= g.default_jackpot : false;
  const local = g.draw_at ? g.draw_at.slice(0, 16) : '';
  return `<section class="panel span-6" aria-labelledby="ctl-${id}"><div class="panel-head"><h2 class="title" id="ctl-${id}">${icon('ticket')}${name}</h2>${g.sales_open ? badge('Sales open', 'credit') : badge('Sales closed', 'quiet')}</div>
    <dl class="facts">
      <div><dt>Pool</dt><dd class="gold">${fmt(g.jackpot)}</dd></div>
      <div><dt>Tickets</dt><dd>${fmt(s?.tickets)}</dd></div>
      <div><dt>Players</dt><dd>${fmt(s?.players)}</dd></div>
      <div><dt>Fees</dt><dd>${fmt(s?.fees)}</dd></div>
    </dl>
    <p class="muted small facts-note">${g.default_jackpot > 0 ? `The ${fmt(g.default_jackpot)} gold seed is ${covers ? 'covered' : 'not yet covered'} by this draw’s fees.` : 'No seed: this raffle pays out only ticket money.'}</p>
    <div class="sections">
      <form class="form" data-form="draw-time" data-lottery="${id}">
        <div class="field"><label for="time-${id}">${name} draw time (UTC)</label><input class="input" id="time-${id}" name="at" type="datetime-local" value="${esc(local)}" aria-describedby="time-${id}-now">
          <p class="hint" id="time-${id}-now">${announced(g.draw_at)}</p></div>
        <div class="form-actions"><button class="btn btn-ghost btn-sm" type="submit">Announce ${name} draw</button>${g.draw_at ? `<button class="btn btn-ghost btn-sm" type="button" data-action="clear-time" data-lottery="${id}">Clear time</button>` : ''}</div>
      </form>
      <div class="form-row">
        <form class="form" data-form="price" data-lottery="${id}"><div class="field"><label for="price-${id}">${name} ticket price (gold)</label><input class="input input-num" id="price-${id}" name="price" type="number" min="1" max="1000000" step="1" aria-describedby="price-${id}-now">
          <p class="hint" id="price-${id}-now">Now ${fmt(g.ticket_price)}.</p></div>
          <div class="form-actions"><button class="btn btn-ghost btn-sm" type="submit">Save ${name} price</button></div></form>
        <form class="form" data-form="pool" data-lottery="${id}"><div class="field"><label for="pool-${id}">${name} pool (gold)</label><input class="input input-num" id="pool-${id}" name="pool" type="number" min="0" step="1" aria-describedby="pool-${id}-now">
          <p class="hint" id="pool-${id}-now">Now ${fmt(g.jackpot)}.</p></div>
          <div class="form-actions"><button class="btn btn-ghost btn-sm" type="submit">Set ${name} pool</button><button class="link-btn small" type="button" data-action="pool-to-tickets" data-lottery="${id}">Ticket money only</button></div></form>
      </div>
    </div>
    <div class="panel-foot sections-foot">
      <button class="btn btn-primary" type="button" data-action="draw" data-lottery="${id}">${icon('trophy')}Draw the ${name} winner</button>
      <button class="btn btn-ghost" type="button" data-action="sales" data-lottery="${id}" data-open="${!g.sales_open}">${g.sales_open ? `Close ${name} sales` : `Open ${name} sales`}</button>
      <button class="link-btn small" type="button" data-action="reopen" data-lottery="${id}">Start a fresh, empty ${name} draw</button>
    </div></section>`;
}

/** The draw time as the organizer needs it: when, how long to go, or that it is due. */
function announced(at: string | null): string {
  if (!at) return 'Not announced. Players see it under the pool.';
  if (Date.parse(at) <= Date.now()) return `Announced for ${esc(utc(at))}: due now. Draw it, or clear the time.`;
  return `Announced: ${esc(utc(at))} · ${ticking(at)}`;
}

function watcherPanel(v: WatchView | null): string {
  const t = state.terms;
  const facts = v?.on ? `<dl class="facts">
      <div><dt>Last good look</dt><dd class="small">${v.ok_at ? esc(ago(v.ok_at)) : 'not yet'}</dd></div>
      <div><dt>Login runs out</dt><dd class="small">${v.login_ends ? esc(utc(v.login_ends)) : 'unknown'}</dd></div>
      <div><dt>Deposit listing</dt><dd class="small">${v.listing ? `${fmt(v.listing.remaining)} left` : 'none seen'}</dd></div>
      <div><dt>Crediting since</dt><dd class="small">${v.since ? esc(utc(v.since)) : '–'}</dd></div></dl>` : '';
  const warnings = v ? watcherWarnings(v) : [];
  const sales = v?.sales.length
    ? `<table class="table stack"><thead><tr><th>Player in the game</th><th>Trade</th><th class="right">Credits</th><th>What happened</th></tr></thead><tbody>
      ${v.sales.map((s) => `<tr><td><strong>${esc(s.name)}</strong><br><span class="muted small">${esc(day(s.at))} UTC</span></td>
        <td>${s.kind === 'market' ? `${fmt(s.units)} ${esc(t?.item_label ?? 'units')} for ${goldOf(s.gross_cents)}` : `${goldOf(s.gross_cents)} by contract`}</td>
        <td class="num right">${s.state === 'deposit' && s.reason !== 'paid by hand' ? `+${fmt(s.gold)}` : '–'}</td>
        <td data-wide>${s.state === 'deposit' ? (s.reason === 'paid by hand' ? badge('Already paid by hand', 'quiet') : badge('Credited', 'credit')) : s.state === 'open' ? badge('Waiting', 'waiting') : `${badge('Not a deposit', 'quiet')} <span class="muted small">${esc(s.reason ?? '')}</span>`}</td></tr>`).join('')}
      </tbody></table>`
    : '<p class="empty">No trades seen yet.</p>';
  return `<section class="panel span-12" aria-labelledby="watcher-title"><div class="panel-head"><h2 id="watcher-title">${icon('satellite')}Watcher: deposits that credit themselves</h2>
      ${v?.on ? (v.error ? badge('On, failing', 'danger') : badge('On', 'credit')) : badge('Off', 'quiet')}</div>
    <div class="sections">
      <div class="sections tight">
        <p class="muted small">Reads the House’s trade ledger in the game with the House’s login and credits each deposit purchase to the account with the buyer’s name, once. Gold-for-item contracts count too.</p>
        ${facts}
        ${v?.error ? `<p class="notice notice-danger" role="alert">${icon('warning')}<span>${esc(v.error)}</span></p>` : ''}
        ${warnings.length ? `<div class="notice notice-waiting">${icon('warning')}<ul class="plain">${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div class="grid">
        <form class="form span-6" data-form="watcher-login">
          <div class="field"><label for="watcher-token">${v?.on ? 'Replace the House’s game login' : 'The House’s game login'}</label><input class="input" id="watcher-token" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="Paste the token" aria-describedby="watcher-token-how">
            <p class="hint" id="watcher-token-how">On parlamentum.org, signed in as the House: F12, Console, type <code>localStorage.token</code>, Enter, copy the value. It lasts about a week; this page warns two days ahead. It is stored sealed and never shown again.</p></div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">${v?.on ? 'Save new login' : 'Turn the watcher on'}</button>
            ${v?.on ? `<button class="btn btn-ghost" type="button" data-action="watcher-look">${icon('refresh')}Look now</button><button class="btn btn-danger" type="button" data-action="watcher-stop">Turn off</button>` : ''}</div>
        </form>
        ${t ? termsForm(t) : ''}
      </div>
      <div><h3 class="label">Latest trades seen</h3>${sales}</div>
    </div></section>`;
}

function termsForm(t: NonNullable<typeof state.terms>): string {
  const gross = 100 * t.price_cents, tax = t.export_tax_pct > 0 ? Math.max(1, Math.floor((gross * t.export_tax_pct) / 100)) : 0;
  return `<form class="form span-6" data-form="terms">
    <div class="form-row">
      <div class="field"><label for="term-house">House name in the game</label><input class="input" id="term-house" name="house" maxlength="40" value="${esc(t.house_name)}"></div>
      <div class="field"><label for="term-label">Item, as players see it</label><input class="input" id="term-label" name="label" maxlength="40" value="${esc(t.item_label)}"></div>
      <div class="field"><label for="term-item">Game item code</label><input class="input" id="term-item" name="item" maxlength="40" value="${esc(t.item)}"></div>
      <div class="field"><label for="term-tier">Tier (blank: any)</label><input class="input" id="term-tier" name="tier" maxlength="3" value="${esc(t.tier ?? '')}"></div>
      <div class="field"><label for="term-price">Deposit price (gold a unit)</label><input class="input input-num" id="term-price" name="price" type="number" min="0.01" step="0.01" value="${(t.price_cents / 100).toFixed(2)}"></div>
      <div class="field"><label for="term-export">House export tax (%)</label><input class="input input-num" id="term-export" name="export" type="number" min="0" max="50" step="0.5" value="${t.export_tax_pct}"></div>
      <div class="field"><label for="term-import">House import tax (%)</label><input class="input input-num" id="term-import" name="import" type="number" min="0" max="50" step="0.5" value="${t.import_tax_pct}"></div>
    </div>
    <p class="muted small">At these terms 100 units credit ${fmt(Math.floor((gross - tax) / 100))} gold, and a withdrawal of 100 is listed at ${esc(listInstruction(100).replace(/^List 1 .* at /, ''))}.</p>
    <div class="form-actions"><button class="btn btn-ghost" type="submit">Save deposit terms</button></div>
  </form>`;
}

function dangerZone(): string {
  return `<section class="panel span-12 danger-zone" aria-labelledby="danger-title"><div class="panel-head"><h2 id="danger-title">${icon('warning')}Can’t be undone</h2></div>
    <p class="muted small">Both refund every ticket in the open draws, price and fee, and keep the winners’ history.</p>
    <div class="panel-foot">
      <button class="btn btn-danger" type="button" data-action="cancel-all">${icon('ban')}Cancel all open tickets and refund</button>
      <button class="btn btn-danger" type="button" data-action="restart-all">${icon('refresh')}Restart both draws</button>
    </div></section>`;
}

const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60_000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

/** What needs the organizer: a login about to run out, a deposit listing low, ending or gone, no good look lately. */
function watcherWarnings(v: WatchView): string[] {
  const out: string[] = [], now = Date.now(), t = state.terms;
  if (!v.on) return out;
  if (v.login_ends) {
    const ends = Date.parse(v.login_ends);
    if (ends <= now) out.push('The game login has run out: paste a fresh one.');
    else if (ends - now < 2 * 86_400_000) out.push(`The game login runs out ${utc(v.login_ends)}: paste a fresh one before then.`);
  }
  if (v.ok_at && !v.error) {
    if (!v.listing) out.push(`No ${t?.item_label ?? 'deposit item'} listed at ${t ? goldOf(t.price_cents) : 'the deposit price'}: players can’t deposit until some is listed.`);
    else {
      if (v.listing.remaining < 200) out.push(`Only ${fmt(v.listing.remaining)} left on the deposit listing.`);
      if (Date.parse(v.listing.endsAt) - now < 12 * 3_600_000) out.push(`The deposit listing ends ${utc(v.listing.endsAt)}.`);
    }
  }
  if (v.ok_at && now - Date.parse(v.ok_at) > 3_600_000) out.push(`No good look at the game since ${utc(v.ok_at)}.`);
  return out;
}
