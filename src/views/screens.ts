// The players' screens: the dashboard, the wallet, all draws, and the account.
import { day, esc, fmt, goldOf } from '../lib/format.ts';
import { icon } from '../lib/icons.ts';
import { state, type Move } from '../state.ts';
import { houseLine, listInstruction, MOVE_KIND, poolPanel, signed, signInForms, ticketsPanel, waitingList, walletPanel, winnersPanel, winnersTable } from './parts.ts';

const offline = () => `<section class="panel span-12"><p class="notice notice-danger">${icon('warning')}<span>The lottery can’t be reached right now. Your gold is safe; try again in a minute.</span></p>
  <div class="panel-foot"><button class="btn btn-ghost" type="button" data-action="reload">${icon('refresh')}Try again</button></div></section>`;

export function dashboard(): string {
  if (state.offline) return `<div class="grid">${offline()}</div>`;
  return `<h1 class="visually-hidden">Parlamentum Lottery</h1>
  <div class="grid dash">
    ${poolPanel('mini')}
    ${poolPanel('grand')}
    ${walletPanel()}
    ${ticketsPanel('span-5')}
    ${winnersPanel('span-7')}
    ${houseLine()}
  </div>`;
}

// ---------- the wallet ----------

export type WalletTab = 'deposit' | 'withdraw' | 'history';

export function wallet(tab: WalletTab): string {
  const head = `<div class="page-head"><div><h1>Wallet</h1><p>${state.me ? `${fmt(state.me.gold)} gold in your balance.` : 'Sign in to deposit, withdraw and see your history.'}</p></div></div>`;
  if (!state.session) return `${head}<div class="grid"><section class="panel span-6">${signInForms()}</section></div>`;
  const tabs = (['deposit', 'withdraw', 'history'] as const).map((t) =>
    `<a href="#/wallet/${t}" ${t === tab ? 'aria-current="page"' : ''}>${{ deposit: 'Deposit', withdraw: 'Withdraw', history: 'History' }[t]}</a>`).join('');
  const body = tab === 'deposit' ? depositTab() : tab === 'withdraw' ? withdrawTab() : historyTab();
  return `${head}<nav class="tabs" aria-label="Wallet">${tabs}</nav>${body}`;
}

function depositTab(): string {
  const t = state.terms;
  if (!t) return '<p class="empty">The deposit terms couldn’t be loaded.</p>';
  const name = state.me?.username ?? '';
  const gross = 100 * t.price_cents, tax = t.export_tax_pct > 0 ? Math.max(1, Math.floor((gross * t.export_tax_pct) / 100)) : 0;
  const per100 = Math.floor((gross - tax) / 100);
  const full = state.myDeposits.length >= 3;
  return `<div class="grid">
    <section class="panel span-7" aria-labelledby="how-deposit"><div class="panel-head"><h2 id="how-deposit">${icon('arrow-down')}How to deposit</h2>
      <span class="status-dot ${t.automatic ? 'on' : 'off'}">${t.automatic ? 'Automatic' : 'By hand'}</span></div>
      <ol class="steps">
        <li><div><strong>Buy ${esc(t.item_label)}${t.tier ? ` (${esc(t.tier)})` : ''} from ${esc(t.house_name)} on the global market at ${goldOf(t.price_cents)} gold a unit.</strong>
          <span class="muted small">Any amount. Buy it as <b>${esc(name)}</b>: deposits are matched to your Parlamentum name.</span></div></li>
        <li><div><strong>${t.automatic ? 'It is credited by itself within a few minutes.' : 'Report it below; it is credited once the trade is checked.'}</strong>
          <span class="muted small">You get what ${esc(t.house_name)} receives after the game’s ${t.export_tax_pct}% export tax, in whole gold: 100 units make ${fmt(per100)} gold.</span></div></li>
        ${t.automatic ? `<li><div><strong>Or send gold by contract.</strong><span class="muted small">A contract that sends ${esc(t.house_name)} gold for one ${esc(t.item_label)} counts too, without the market tax.</span></div></li>` : ''}
      </ol>
    </section>
    <section class="panel span-5" aria-labelledby="report-deposit"><div class="panel-head"><h2 id="report-deposit">${icon('stamp')}Report a deposit</h2></div>
      <form class="form" data-form="deposit">
        <p class="muted small">${t.automatic ? 'Optional: deposits credit themselves. A report helps if one doesn’t arrive.' : 'Enter the gold your purchase should credit.'}</p>
        <div class="field"><label for="deposit-amount">Gold</label><input class="input input-num" id="deposit-amount" name="amount" type="number" inputmode="numeric" min="1" max="1000000" step="1" required></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit" ${full ? 'disabled' : ''}>Report</button><span class="muted small">${full ? '3 are waiting already.' : `${state.myDeposits.length} of 3 waiting.`}</span></div>
      </form>
      ${waitingList(true)}
    </section>
  </div>`;
}

function withdrawTab(): string {
  const t = state.terms;
  const full = state.myWithdrawals.length >= 3;
  return `<div class="grid">
    <section class="panel span-7" aria-labelledby="ask-withdraw"><div class="panel-head"><h2 id="ask-withdraw">${icon('arrow-up')}Withdraw gold</h2></div>
      <form class="form" data-form="withdraw" novalidate>
        <div class="field"><label for="withdraw-amount">Gold to withdraw</label><input class="input input-num" id="withdraw-amount" name="amount" type="number" inputmode="numeric" min="1" step="1" data-preview="withdraw" aria-describedby="withdraw-preview">
          <p class="hint" id="withdraw-preview">For example, 100 gold: ${esc(listInstruction(100).replace(/^List/, 'list'))}.</p></div>
        <ol class="steps">
          <li><div><strong>Ask here.</strong><span class="muted small">The gold leaves your balance and is held until it’s paid.</span></div></li>
          <li><div><strong>List 1 ${esc(t?.item_label ?? 'Raw Copper')} on the global market at the price shown.</strong><span class="muted small">The game takes your own country’s export tax from that sale.</span></div></li>
          <li><div><strong>${esc(t?.house_name ?? 'The House')} buys it.</strong><span class="muted small">That pays you; the request is then marked paid.</span></div></li>
        </ol>
        <div class="form-actions"><button class="btn btn-primary" type="submit" ${full ? 'disabled' : ''}>Request withdrawal</button><span class="muted small">${full ? '3 are waiting already.' : `${state.myWithdrawals.length} of 3 waiting.`}</span></div>
      </form>
    </section>
    <section class="panel span-5" aria-labelledby="waiting-title"><div class="panel-head"><h2 id="waiting-title">${icon('hourglass')}Waiting</h2></div>${waitingList()}</section>
  </div>`;
}

function historyTab(): string {
  const moves: Move[] = state.myMoves;
  if (!moves.length) return '<section class="panel"><p class="empty">No gold has moved yet. Deposits, tickets and prizes show up here, each with the balance after it.</p></section>';
  let running = state.me?.gold ?? 0;
  const rows = moves.map((m) => {
    const after = running;
    running -= m.delta;
    return `<tr><td>${esc(day(m.created_at))}</td><td><strong>${esc(MOVE_KIND[m.kind] ?? m.kind)}</strong>${m.note ? `<br><span class="muted small">${esc(m.note)}</span>` : ''}</td>
      <td class="num right ${m.delta > 0 ? 'credit' : ''}">${signed(m.delta)}</td><td class="num right muted">${fmt(after)}</td></tr>`;
  }).join('');
  return `<section class="panel" aria-labelledby="history-title"><div class="panel-head"><h2 id="history-title">${icon('history')}Every move of your gold</h2><span class="muted small">Newest first, UTC</span></div>
    <table class="table"><thead><tr><th>When</th><th>What</th><th class="right">Gold</th><th class="right">Balance</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

// ---------- all draws ----------

export function draws(): string {
  return `<div class="page-head"><div><h1>Draws</h1><p>The latest draws, each checked in your browser.</p></div></div>
  <div class="grid">
    <section class="panel span-8" aria-labelledby="all-draws"><div class="panel-head"><h2 id="all-draws">${icon('trophy')}Winners</h2></div>${winnersTable(state.winners)}</section>
    <section class="panel span-4" id="how" aria-labelledby="how-title"><div class="panel-head"><h2 id="how-title">${icon('seal')}How a draw is checked</h2></div>
      <ol class="steps">
        <li><div><strong>Sealed before.</strong><span class="muted small">When a draw opens, a secret seed is drawn and only its SHA-256 fingerprint is shown under the pool.</span></div></li>
        <li><div><strong>Revealed after.</strong><span class="muted small">At the draw the seed and the ticket list are published. The seed must have that fingerprint.</span></div></li>
        <li><div><strong>Anyone can redo it.</strong><span class="muted small">The winner’s place in the list is SHA-256 of “seed:draw:list fingerprint”, first 13 hex digits, modulo the number of tickets. This page redoes it for every draw it shows.</span></div></li>
      </ol>
      <p class="muted small how-tool">To check a seed yourself, copy it from a draw’s proof and run <code>printf %s "SEED" | shasum -a 256</code>: the result must be that draw’s fingerprint.</p>
    </section>
  </div>`;
}

// ---------- the account ----------

export function account(): string {
  if (!state.session) return `<div class="page-head"><div><h1>Account</h1><p>Sign in with your Parlamentum name.</p></div></div><div class="grid"><section class="panel span-6">${signInForms()}</section></div>`;
  return `<div class="page-head"><div><h1>Account</h1></div></div>
  <div class="grid"><section class="panel span-6" aria-labelledby="me-title"><div class="panel-head"><h2 id="me-title">${icon('user')}Signed in</h2></div>
    <p class="balance">${esc(state.me?.username ?? state.session.user.email ?? '')}</p>
    <p class="muted small">Deposits are matched to this name. If it isn’t exactly your Parlamentum name, tell the organizer before you deposit.</p>
    <div class="panel-foot"><button class="btn btn-ghost" type="button" data-action="sign-out">${icon('log-out')}Sign out</button></div>
  </section></div>`;
}
