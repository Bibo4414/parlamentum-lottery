// Pieces several screens share: a raffle's pool panel, the wallet panel, the sign-in form, ticket stubs, the winners
// table with each draw's proof, and the House line. Each returns HTML; everything a person or the database wrote is
// escaped.
import { cost, type DrawCheck } from '../data.ts';
import { countdown, day, esc, fmt, goldOf, utc } from '../lib/format.ts';
import { icon } from '../lib/icons.ts';
import { LOTTERY_NAMES, state, type LotteryId, type Winner } from '../state.ts';

/** What the page remembers between renders: how many tickets each raffle's buy box is set to, which sign-in tab is
 *  open, and each finished draw's check: run once in this browser, its details unfolded or not. */
export const ui = {
  qty: { mini: 1, grand: 1 } as Record<LotteryId, number>,
  signTab: 'in' as 'in' | 'up',
  checks: new Map<number, DrawCheck | 'pending' | 'failed'>(),
  open: new Set<number>(),
  /** checks that finished since the last render: their stamp lands once */
  fresh: new Set<number>(),
};
export const QUANTITIES = [1, 2, 3, 5, 10];

export const badge = (text: string, tone: 'credit' | 'waiting' | 'danger' | 'gold' | 'quiet') => `<span class="badge badge-${tone}">${esc(text)}</span>`;
const isDue = (iso: string | null) => !!iso && Date.parse(iso) <= Date.now();

/** "in 2 d 4 h", kept ticking by main.ts. */
export const ticking = (iso: string) => `<span class="countdown" data-countdown="${esc(iso)}">${esc(countdown(iso) ? `in ${countdown(iso)}` : 'now')}</span>`;

export function drawWhen(id: LotteryId): string {
  const g = state.games[id];
  if (!g?.draw_at) return 'No draw time announced yet';
  if (isDue(g.draw_at)) return `Draw due since ${esc(utc(g.draw_at))}; the organizer draws it shortly`;
  return `Draw ${esc(utc(g.draw_at))} · ${ticking(g.draw_at)}`;
}

// ---------- a raffle's pool ----------

export function poolPanel(id: LotteryId, span = 'span-4'): string {
  const g = state.games[id];
  const name = LOTTERY_NAMES[id];
  if (!g) return `<section class="panel ${span}" aria-label="${name}"><p class="empty">The ${name} isn’t set up yet.</p></section>`;
  const due = isDue(g.draw_at);
  const status = !g.sales_open ? badge('Sales closed', 'quiet') : due ? badge('Draw due', 'waiting') : badge('Sales open', 'credit');
  const mine = state.myTickets.filter((t) => t.lottery_id === id).length;
  const fee1 = Math.ceil(g.ticket_price / 10);
  const seed = g.default_jackpot > 0 ? `Each draw starts at ${fmt(g.default_jackpot)} gold put in by the House; every ticket’s price is added.` : 'Every ticket’s price goes into the pool.';
  return `
  <section class="panel pool ${span}" aria-labelledby="pool-${id}">
    <div class="pool-top">
      <div class="panel-head"><h2 id="pool-${id}">${icon('ticket')}${name}</h2>${status}</div>
      <p class="pool-figure"><strong>${fmt(g.jackpot)}</strong><span>gold in the pool</span></p>
      <p class="pool-note">${seed}</p>
      <p class="draw-line">${icon('clock')}<span>${drawWhen(id)}</span></p>
      ${g.seed_hash ? `<p class="seal">${icon('seal')}<span>Sealed draw</span><code title="${esc(g.seed_hash)}">${esc(g.seed_hash.slice(0, 12))}…</code><a href="#/draws" data-scroll="how">how it’s checked</a></p>` : ''}
    </div>
    <div class="buy">${buyBox(id, g.ticket_price, fee1, g.sales_open && !due)}${mine ? `<p class="price">You hold ${fmt(mine)} ${mine === 1 ? 'ticket' : 'tickets'} in this draw.</p>` : ''}</div>
  </section>`;
}

function buyBox(id: LotteryId, price: number, fee1: number, open: boolean): string {
  const priceLine = `<p class="price"><strong>${fmt(price)} gold</strong> a ticket + ${fmt(fee1)} gold fee (10%)</p>`;
  if (!state.session) return `${priceLine}<div class="buy-row"><button class="btn btn-primary" type="button" data-action="go-sign-in">Sign in to buy</button></div>`;
  if (state.me?.organizer) return `${priceLine}<p class="notice">${icon('lock')}<span>Organizer accounts can’t buy tickets: the organizer can see each draw’s seed.</span></p>`;
  if (!open) return `${priceLine}<p class="notice">${icon('hourglass')}<span>Ticket sales are closed for this draw.</span></p>`;
  const q = ui.qty[id];
  const c = cost(price, q);
  const short = (state.me?.gold ?? 0) < c.total;
  return `${priceLine}
    <div class="buy-row">
      <div class="segmented" role="group" aria-label="How many ${LOTTERY_NAMES[id]} tickets">
        ${QUANTITIES.map((n) => `<button type="button" data-action="qty" data-lottery="${id}" data-qty="${n}" aria-pressed="${n === q}">${n}</button>`).join('')}
      </div>
      <button class="btn btn-primary" type="button" data-action="buy" data-lottery="${id}" ${short ? 'disabled' : ''}>Buy ${q === 1 ? '1 ticket' : `${q} tickets`} · ${fmt(c.total)} gold</button>
    </div>
    ${short ? `<p class="price danger-text">You have ${fmt(state.me?.gold ?? 0)} gold. <a href="#/wallet">Deposit</a> to buy ${q === 1 ? 'it' : 'them'}.</p>` : ''}`;
}

// ---------- the wallet panel ----------

/** How each line of a player's gold history reads. */
export const MOVE_KIND: Record<string, string> = {
  opening: 'Balance carried over', deposit: 'Deposit', credit: 'Added by the organizer', tickets: 'Tickets', refund: 'Tickets refunded',
  prize: 'Prize', withdrawal: 'Withdrawal', withdrawal_refund: 'Withdrawal returned',
};
export const signed = (delta: number) => `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`;

export function walletPanel(span = 'span-4'): string {
  if (!state.session) return `<section class="panel ${span} wallet-panel" aria-labelledby="sign-in-title"><div class="panel-head"><h2 id="sign-in-title">${icon('user')}Your account</h2></div>${signInForms()}</section>`;
  const terms = state.terms;
  const recent = state.myMoves.slice(0, 3);
  const side = waitingList(true) + (recent.length
    ? `<h3 class="label">Recent</h3><ul class="rows">${recent.map((m) => `<li><span>${esc(MOVE_KIND[m.kind] ?? m.kind)} <span class="muted small">${esc(day(m.created_at))}</span></span><span class="num ${m.delta > 0 ? 'credit' : ''}">${signed(m.delta)}</span></li>`).join('')}</ul>`
    : '');
  return `
  <section class="panel ${span} wallet-panel" aria-labelledby="wallet-title">
    <div class="panel-head"><h2 id="wallet-title">${icon('wallet')}Your gold</h2><a class="link-btn small" href="#/wallet/history">History</a></div>
    <div class="wallet-body">
      <div>
        <p class="balance">${fmt(state.me?.gold)}<span>gold</span></p>
        ${terms ? `<p class="status-dot ${terms.automatic ? 'on' : 'off'}">${terms.automatic ? 'Deposits credit themselves within minutes' : 'Deposits are credited by the organizer'}</p>` : ''}
        <div class="panel-foot">
          <a class="btn btn-primary" href="#/wallet/deposit">${icon('arrow-down')}Deposit</a>
          <a class="btn btn-ghost" href="#/wallet/withdraw">${icon('arrow-up')}Withdraw</a>
        </div>
      </div>
      ${side ? `<div>${side}</div>` : ''}
    </div>
  </section>`;
}

/** What the player is waiting for: withdrawals to be paid, reported deposits to be credited. */
export function waitingList(labelled = false): string {
  const items = [
    ...state.myWithdrawals.map((w) => `<li><strong>Withdrawal · ${fmt(w.amount)} gold</strong><span class="muted small">${esc(listInstruction(w.amount))}</span></li>`),
    ...state.myDeposits.map((d) => `<li><strong>Deposit report · ${fmt(d.amount)} gold</strong><span class="muted small">Reported ${esc(day(d.created_at))} UTC</span></li>`),
  ];
  if (!items.length) return labelled ? '' : '<p class="empty">Nothing waiting.</p>';
  return `${labelled ? '<h3 class="label">Waiting</h3>' : ''}<ul class="rows stacked">${items.join('')}</ul>`;
}

/** How a withdrawal is paid: the player lists one unit at the amount divided by (1 + the House's import tax), so the
 *  House pays the amount in all. */
export function listInstruction(amount: number): string {
  const label = state.terms?.item_label ?? 'Raw Copper';
  const tax = state.terms?.import_tax_pct ?? 0;
  return `List 1 ${label} at ${goldOf(Math.floor((amount * 10000) / (100 + tax)))} gold`;
}

// ---------- signing in ----------

export function signInForms(): string {
  const up = ui.signTab === 'up';
  return `
  <div class="tabs" role="tablist" aria-label="Account">
    <button type="button" role="tab" id="tab-sign-in" aria-selected="${!up}" aria-controls="form-sign-in" data-action="sign-tab" data-tab="in">Sign in</button>
    <button type="button" role="tab" id="tab-sign-up" aria-selected="${up}" aria-controls="form-sign-up" data-action="sign-tab" data-tab="up">Create account</button>
  </div>
  <form class="form" id="form-sign-in" role="tabpanel" aria-labelledby="tab-sign-in" data-form="sign-in" ${up ? 'hidden' : ''}>
    <div class="field"><label for="in-name">Parlamentum name</label><input class="input" id="in-name" name="name" autocomplete="username" maxlength="24" required></div>
    <div class="field"><label for="in-password">Password</label><input class="input" id="in-password" name="password" type="password" autocomplete="current-password" required></div>
    <details class="more"><summary>${icon('plus')}Signed up with an e-mail address?</summary>
      <div class="field"><label for="in-email">E-mail</label><input class="input" id="in-email" name="email" type="email" autocomplete="email"><p class="hint">Only if your account was made with one.</p></div></details>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Sign in</button></div>
  </form>
  <form class="form" id="form-sign-up" role="tabpanel" aria-labelledby="tab-sign-up" data-form="sign-up" ${up ? '' : 'hidden'}>
    <div class="field"><label for="up-name">Your Parlamentum name</label><input class="input" id="up-name" name="name" autocomplete="username" maxlength="24" required aria-describedby="up-name-hint">
      <p class="hint" id="up-name-hint">Exactly as you play: deposits are matched to this name.</p></div>
    <div class="field"><label for="up-password">Password</label><input class="input" id="up-password" name="password" type="password" autocomplete="new-password" minlength="8" required aria-describedby="up-password-hint"><p class="hint" id="up-password-hint">At least 8 characters.</p></div>
    <details class="more"><summary>${icon('plus')}Add an e-mail address (optional)</summary>
      <div class="field"><label for="up-email">E-mail</label><input class="input" id="up-email" name="email" type="email" autocomplete="email"></div></details>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Create account</button></div>
  </form>`;
}

// ---------- tickets ----------

export function ticketsPanel(span = 'span-6'): string {
  const body = !state.session
    ? '<p class="empty">Sign in to see your tickets.</p>'
    : (['mini', 'grand'] as LotteryId[]).map((id) => {
        const mine = state.myTickets.filter((t) => t.lottery_id === id);
        return `<div class="ticket-group"><span>${LOTTERY_NAMES[id]}</span>${mine.length
          ? `<div class="stubs">${mine.map((t) => `<span class="stub" data-state="in-draw">#${fmt(t.ticket_number)}</span>`).join('')}</div>`
          : '<p class="muted small">None in this draw.</p>'}</div>`;
      }).join('');
  const won = state.me && state.winners.find((w) => w.winner_username === state.me?.username && Date.now() - Date.parse(w.drawn_at) < 7 * 86_400_000);
  const banner = won ? `<p class="notice notice-credit">${icon('trophy')}<span>You won the ${esc(lotteryName(won.lottery_id))} on ${esc(day(won.drawn_at))} UTC with ticket #${fmt(won.ticket_number)}: ${fmt(won.prize_gold)} gold, already in your balance.</span></p>` : '';
  return `<section class="panel ${span}" aria-labelledby="tickets-title"><div class="panel-head"><h2 id="tickets-title">${icon('ticket')}Your tickets</h2></div>${banner}${body}</section>`;
}

export const lotteryName = (id: string | null) => (id === 'mini' || id === 'grand' ? LOTTERY_NAMES[id] : 'Earlier draw');

// ---------- winners, each with its proof ----------

/** A finished draw's proof: checked in this browser, or being checked; it unfolds into what was checked. */
function proofStamp(drawId: number | null): string {
  if (drawId === null) return '<span class="proof proof-none">No seed</span>';
  const c = ui.checks.get(drawId);
  if (c === undefined || c === 'pending') return `<span class="proof proof-pending" ${c === undefined ? `data-check="${drawId}"` : ''}>Checking…</span>`;
  if (c === 'failed') return `<button class="proof" type="button" data-action="retry-check" data-draw="${drawId}">${icon('refresh')}<span>Check again</span></button>`;
  const tone = !c.seed ? 'none' : c.verdict.ok ? 'ok' : 'bad';
  const text = { ok: 'Checked', bad: 'Doesn’t check out', none: 'No seed' }[tone];
  const open = ui.open.has(drawId);
  return `<button class="proof proof-${tone}${ui.fresh.has(drawId) ? ' stamp-in' : ''}" type="button" data-action="draw-details" data-draw="${drawId}" aria-expanded="${open}" ${open ? `aria-controls="proof-${drawId}"` : ''}>${icon(tone === 'ok' ? 'circle-check' : tone === 'bad' ? 'circle-x' : 'minus')}<span>${text}</span>${icon('chevron-down')}</button>`;
}

/** What the check found, the fingerprint shown before the draw, and the seed revealed after it. */
function proofDetails(drawId: number): string {
  const c = ui.checks.get(drawId);
  if (!c || typeof c === 'string') return '';
  return `<div class="proof-details" id="proof-${drawId}">
    <ul class="rows checklist">${c.verdict.checks.map((k) => `<li class="${k.ok ? 'ok' : 'bad'}">${icon(k.ok ? 'circle-check' : 'circle-x')}<span>${esc(k.label)}</span></li>`).join('')}</ul>
    ${c.seedHash ? `<div class="seed-line"><span class="label">Fingerprint, shown before the draw</span><code>${esc(c.seedHash)}</code></div>` : ''}
    ${c.seed ? `<div class="seed-line"><span class="label">Seed, revealed at the draw</span><code>${esc(c.seed)}</code>
      <button class="link-btn small" type="button" data-action="copy-seed" data-seed="${esc(c.seed)}">${icon('copy')}Copy seed</button></div>` : ''}
  </div>`;
}

export function winnersTable(rows: Winner[], { when = true } = {}): string {
  if (!rows.length) return '<p class="empty">No draws yet. Each winner shows up here with the draw’s seed, checked in your browser.</p>';
  const cols = when ? 5 : 4;
  return `<table class="table stack winners"><thead><tr><th>Winning ticket</th><th>Winner</th><th class="right">Prize</th>${when ? '<th>Drawn (UTC)</th>' : ''}<th class="right">Proof</th></tr></thead><tbody>
    ${rows.map((w) => {
      const me = state.me && w.winner_username === state.me.username;
      const open = w.draw_id !== null && ui.open.has(w.draw_id);
      return `<tr><td class="c-ticket"><strong>${esc(lotteryName(w.lottery_id))}</strong> <span class="muted">ticket</span> <span class="num gold">#${fmt(w.ticket_number)}</span></td>
        <td class="c-who">${esc(w.winner_username ?? 'Unknown')}${me ? ` ${badge('You', 'credit')}` : ''}<span class="visually-hidden">, ${esc(day(w.drawn_at))} UTC</span></td>
        <td class="c-prize right"><span class="num">${fmt(w.prize_gold)}</span> <span class="unit">gold</span></td>${when ? `<td class="c-when">${esc(day(w.drawn_at))}</td>` : ''}
        <td class="c-proof right">${proofStamp(w.draw_id)}</td></tr>
        ${open && w.draw_id !== null ? `<tr class="verdict-row"><td colspan="${cols}">${proofDetails(w.draw_id)}</td></tr>` : ''}`;
    }).join('')}
  </tbody></table>`;
}

export function winnersPanel(span = 'span-6'): string {
  return `<section class="panel ${span}" aria-labelledby="winners-title"><div class="panel-head"><h2 id="winners-title">${icon('trophy')}Last winners</h2><a class="link-btn small" href="#/draws">All draws</a></div>${winnersTable(state.winners.slice(0, 3), { when: false })}</section>`;
}

// ---------- the House ----------

/** Who runs the raffles and what a deposit is; each pool panel already carries its own draw time. */
export function houseLine(): string {
  const t = state.terms;
  if (!t) return '';
  return `<section class="panel span-12 house-line" aria-label="The House">
    <p><span class="label">The House</span><strong>${esc(t.house_name)}</strong><span class="muted small">runs the draws and holds the gold</span></p>
    <p><span class="label">Deposits</span><strong>${esc(t.item_label)} at ${goldOf(t.price_cents)}</strong><span class="muted small">bought from ${esc(t.house_name)} on the global market</span></p>
  </section>`;
}
