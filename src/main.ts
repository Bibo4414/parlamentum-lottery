// The lottery page: the shell, the routes, and every click and form, handled in one place.
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import * as data from './data.ts';
import { $, $maybe, busy, keepForms, toast } from './lib/dom.ts';
import { countdown, esc, fmt } from './lib/format.ts';
import { icon, type IconName } from './lib/icons.ts';
import { supabase } from './lib/supabase.ts';
import { isLotteryId, LOTTERY_NAMES, state } from './state.ts';
import { organizer, type OrganizerTab } from './views/organizer.ts';
import { listInstruction, ui } from './views/parts.ts';
import { account, dashboard, draws, wallet, type WalletTab } from './views/screens.ts';

// ---------- routes ----------

type Route = { name: 'dashboard' } | { name: 'wallet'; tab: WalletTab } | { name: 'draws' } | { name: 'account' } | { name: 'organizer'; tab: OrganizerTab };
function route(): Route {
  const [first = '', second = ''] = location.hash.replace(/^#\/?/, '').split('/');
  if (first === 'wallet') return { name: 'wallet', tab: second === 'withdraw' || second === 'history' ? second : 'deposit' };
  if (first === 'draws' || first === 'winners') return { name: 'draws' }; // #/winners: the page's first address
  if (first === 'organizer') return { name: 'organizer', tab: second === 'draws' || second === 'watcher' ? second : 'requests' };
  if (first === 'account') return { name: 'account' };
  return { name: 'dashboard' };
}
const TITLES: Record<Route['name'], string> = { dashboard: 'Parlamentum Lottery', wallet: 'Wallet', draws: 'Draws', account: 'Account', organizer: 'Organizer' };

// ---------- the shell ----------

function shell(r: Route) {
  const links: { href: string; name: Route['name']; label: string; icon: IconName }[] = [
    { href: '#/', name: 'dashboard', label: 'Dashboard', icon: 'ticket' },
    { href: '#/wallet', name: 'wallet', label: 'Wallet', icon: 'wallet' },
    { href: '#/draws', name: 'draws', label: 'Draws', icon: 'trophy' },
    ...(state.me?.organizer ? [{ href: '#/organizer', name: 'organizer' as const, label: 'Organizer', icon: 'landmark' as const }] : []),
  ];
  const current = (name: Route['name']) => (name === r.name ? 'aria-current="page"' : '');
  $('#nav').innerHTML = links.map((l) => `<a href="${l.href}" ${current(l.name)}>${esc(l.label)}</a>`).join('');
  $('#tabbar').innerHTML = [...links, { href: '#/account', name: 'account' as const, label: state.session ? 'Account' : 'Sign in', icon: 'user' as const }]
    .map((l) => `<a href="${l.href}" ${current(l.name)}>${icon(l.icon)}<span>${esc(l.label)}</span></a>`).join('');
  const name = state.me?.username ?? 'Account';
  $('#bar-right').innerHTML = state.session
    ? `<a class="chip" href="#/wallet" aria-label="Your gold: ${fmt(state.me?.gold)}">${icon('coins')}<span class="num">${fmt(state.me?.gold)}</span></a>
       <a class="chip account-chip" href="#/account" aria-label="Account: ${esc(name)}">${icon('user')}<span>${esc(name)}</span></a>`
    : `<a class="btn btn-primary btn-sm" href="#/account">Sign in</a>`;
}

const view = (r: Route) =>
  r.name === 'wallet' ? wallet(r.tab) : r.name === 'draws' ? draws() : r.name === 'account' ? account() : r.name === 'organizer' ? organizer(r.tab) : dashboard();

let lastRoute = '';
function render() {
  const r = route();
  const key = `${r.name}/${'tab' in r ? r.tab : ''}`;
  const main = $('#main');
  shell(r);
  keepForms(main, () => { main.innerHTML = view(r); });
  showErrors(main);
  if (key !== lastRoute) {
    document.title = r.name === 'dashboard' ? TITLES.dashboard : `${TITLES[r.name]} · Parlamentum Lottery`;
    if (lastRoute) { window.scrollTo({ top: 0 }); main.focus({ preventScroll: true }); }
    lastRoute = key;
  }
  tick();
  void checkShown();
}

async function refresh() {
  await data.load().catch(() => (state.offline = true));
  render();
}

/** After an action: reload what changed, then say how it went. */
async function after(result: data.Result) {
  if (result.ok) await refresh();
  toast(result.message, result.ok ? 'info' : 'error');
}

// ---------- the countdowns ----------

let refreshAt = 0;
function tick() {
  document.querySelectorAll<HTMLElement>('[data-countdown]').forEach((el) => {
    const left = countdown(el.dataset.countdown ?? '');
    el.textContent = left ? `in ${left}` : 'now';
    // a draw time just passed: sales have closed, so fetch the new state once
    if (!left && Date.now() > refreshAt) { refreshAt = Date.now() + 30_000; void refresh(); }
  });
}

// ---------- the draws on screen, each checked once in this browser ----------

async function checkShown() {
  const ids = [...document.querySelectorAll<HTMLElement>('[data-check]')].map((el) => Number(el.dataset.check)).filter((id) => !ui.checks.has(id));
  if (!ids.length) return;
  ids.forEach((id) => ui.checks.set(id, 'pending'));
  const results = await data.checkDraws(ids);
  for (const id of ids) {
    const found = results.get(id);
    ui.checks.set(id, found ?? 'failed');
    if (found) ui.fresh.add(id);
  }
  render();
  ui.fresh.clear();
}

// ---------- form errors: next to what they are about, kept across re-renders until the form is edited or sent ----------

type FormError = { message: string; field?: string; said?: boolean };
const errors = new Map<string, FormError>();
const formKey = (form: HTMLFormElement) => `${form.dataset.form ?? ''}:${form.dataset.lottery ?? ''}`;

function placeError(form: HTMLFormElement, e: FormError) {
  form.querySelectorAll('.form-error').forEach((el) => el.remove());
  const el = document.createElement('p');
  el.className = 'form-error';
  // read out once, when it appears; a re-render puts it back quietly
  if (!e.said) { el.setAttribute('role', 'alert'); e.said = true; }
  el.innerHTML = `${icon('circle-x')}<span>${esc(e.message)}</span>`;
  const input = e.field ? form.querySelector<HTMLInputElement>(`[name="${e.field}"]`) : null;
  if (input) {
    el.id = `${input.id}-error`;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', [el.id, ...(input.getAttribute('aria-describedby') ?? '').split(' ')].filter(Boolean).join(' '));
    input.insertAdjacentElement('afterend', el);
  } else {
    form.append(el);
  }
}

function showErrors(root: HTMLElement) {
  root.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
    const e = errors.get(formKey(form));
    if (e) placeError(form, e);
  });
}

function clearError(form: HTMLFormElement) {
  if (!errors.delete(formKey(form))) return;
  form.querySelectorAll('.form-error').forEach((el) => el.remove());
  form.querySelectorAll<HTMLInputElement>('[aria-invalid]').forEach((input) => {
    input.removeAttribute('aria-invalid');
    const rest = (input.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id && id !== `${input.id}-error`);
    if (rest.length) input.setAttribute('aria-describedby', rest.join(' ')); else input.removeAttribute('aria-describedby');
  });
}

// ---------- clicks ----------

const num = (v: unknown) => Number(v);
const confirmAnd = (question: string, work: () => Promise<data.Result>) => (confirm(question) ? work().then(after) : Promise.resolve());

document.addEventListener('click', (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-scroll]');
    if (link) setTimeout(() => $maybe(`#${link.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth' }), 60);
    return;
  }
  const d = el.dataset;
  const lottery = isLotteryId(d.lottery) ? d.lottery : null;
  const name = lottery ? LOTTERY_NAMES[lottery] : '';
  switch (d.action) {
    case 'qty': if (lottery) { ui.qty[lottery] = num(d.qty); render(); } break;
    case 'buy': if (lottery) void busy(el, () => data.buy(lottery, ui.qty[lottery])).then(after); break;
    case 'go-sign-in': {
      const field = $maybe<HTMLInputElement>('#in-name');
      if (field) { ui.signTab = 'in'; field.scrollIntoView({ behavior: 'smooth', block: 'center' }); field.focus({ preventScroll: true }); } else location.hash = '#/account';
      break;
    }
    case 'sign-tab': ui.signTab = d.tab === 'up' ? 'up' : 'in'; render(); $maybe<HTMLInputElement>(ui.signTab === 'up' ? '#up-name' : '#in-name')?.focus(); break;
    case 'sign-out': void busy(el, data.signOut).then(after); break;
    case 'reload': void busy(el, refresh); break;
    case 'draw-details': {
      const id = num(d.draw);
      if (!ui.open.delete(id)) ui.open.add(id);
      render();
      $maybe(`[data-action="draw-details"][data-draw="${id}"]`)?.focus();
      break;
    }
    case 'retry-check': ui.checks.delete(num(d.draw)); render(); break;
    case 'copy-seed': {
      const seed = d.seed ?? '';
      void navigator.clipboard?.writeText(seed).then(() => toast('Seed copied.'), () => toast('Couldn’t copy; select the seed and copy it.', 'error'));
      break;
    }
    // the organizer
    case 'settle-deposit': {
      const approve = d.approve === 'true', id = num(d.id);
      if (!approve && !confirm('Reject this deposit report? No gold is added.')) break;
      void busy(el, () => data.settleDeposit(id, approve)).then(async (r) => {
        if (r.askFirst) { if (confirm(r.askFirst)) await after(await data.settleDeposit(id, true, true)); return; }
        await after(r);
      });
      break;
    }
    case 'settle-withdrawal': {
      const paid = d.paid === 'true';
      if (!confirm(paid ? 'Mark this withdrawal paid? Only once you have bought the player’s listing in the game.' : 'Reject this withdrawal? The gold goes back to the player.')) break;
      void busy(el, () => data.settleWithdrawal(num(d.id), paid)).then(after);
      break;
    }
    case 'clear-time': if (lottery) void busy(el, () => data.setDrawTime(lottery, null)).then(after); break;
    case 'pool-to-tickets': if (lottery) void confirmAnd(`Set the ${name} pool to the ticket money alone, without a seed from the House?`, () => busy(el, () => data.poolToTickets(lottery))); break;
    case 'sales': if (lottery) void busy(el, () => data.setSales(lottery, d.open === 'true')).then(after); break;
    case 'draw': if (lottery) void confirmAnd(`Draw the ${name} winner now? The ${name} pool is paid to the winning ticket at once and a new ${name} draw opens.`, () => busy(el, () => data.draw(lottery))); break;
    case 'reopen': if (lottery) void confirmAnd(`Start a fresh, empty ${name} draw? Only possible while this ${name} draw has no tickets.`, () => busy(el, () => data.reopen(lottery))); break;
    case 'cancel-all': void confirmAnd('Cancel every ticket in both open draws and refund them, price and fee?', () => busy(el, data.cancelAllTickets)); break;
    case 'restart-all': void confirmAnd('Restart both draws? Every ticket in them is refunded and fresh draws open at the seed.', () => busy(el, data.restartDraws)); break;
    case 'watcher-look': void busy(el, () => data.watcher('look')).then(after); break;
    case 'watcher-stop': void confirmAnd('Turn the watcher off? Its login is forgotten and deposits are credited by hand again.', () => busy(el, () => data.watcher('stop'))); break;
  }
});

// ---------- forms ----------

document.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  clearError(form);
  const f = new FormData(form);
  const s = (name: string) => String(f.get(name) ?? '').trim();
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const lottery = isLotteryId(form.dataset.lottery) ? form.dataset.lottery : null;
  // a failure is said twice: in the toast, and in the form where the player is looking
  const fail = (message: string, field?: string) => {
    const e: FormError = field ? { message, field } : { message };
    errors.set(formKey(form), e);
    placeError(form, e);
  };
  const go = (work: () => Promise<data.Result>, reset = true) =>
    void busy(button, work).then(async (r) => {
      if (r.ok && reset) form.reset();
      if (!r.ok) fail(r.message);
      await after(r);
    });
  switch (kind) {
    case 'sign-in': go(() => data.signIn(s('name'), String(f.get('password') ?? ''), s('email'))); break;
    case 'sign-up': go(() => data.signUp(s('name'), String(f.get('password') ?? ''), s('email'))); break;
    case 'deposit': go(() => data.requestDeposit(num(s('amount')))); break;
    case 'withdraw': {
      const amount = num(s('amount')), gold = state.me?.gold ?? 0;
      if (!Number.isSafeInteger(amount) || amount < 1) { fail('Enter a whole amount of gold, at least 1.', 'amount'); return; }
      if (amount > gold) { fail(gold > 0 ? `More than your ${fmt(gold)} gold: enter ${fmt(gold)} or less.` : 'You have no gold to withdraw yet.', 'amount'); return; }
      if (!confirm(`Withdraw ${fmt(amount)} gold? It leaves your balance now and is held until it is paid. Then: ${listInstruction(amount)} on the global market.`)) return;
      go(() => data.requestWithdrawal(amount));
      break;
    }
    case 'credit': go(() => data.credit(s('name'), num(s('amount')))); break;
    case 'draw-time': {
      const at = s('at');
      if (!at) { fail('Choose a date and time first.', 'at'); return; }
      if (lottery) go(() => data.setDrawTime(lottery, new Date(`${at}Z`).toISOString()), false);
      break;
    }
    case 'price': if (lottery) go(() => data.setPrice(lottery, num(s('price')))); break;
    case 'pool': if (lottery) go(() => data.setPool(lottery, num(s('pool')))); break;
    case 'watcher-login': go(() => data.watcher('login', { token: s('token') })); break;
    case 'terms': go(() => data.setTerms({
      house: s('house'), label: s('label'), item: s('item'), tier: s('tier'),
      priceCents: Math.round(num(s('price')) * 100), exportTax: num(s('export')), importTax: num(s('import')),
    }), false); break;
  }
});

document.addEventListener('input', (event) => {
  const el = event.target as HTMLInputElement;
  // editing a form takes its error away
  const form = el.closest<HTMLFormElement>('form[data-form]');
  if (form) clearError(form);
  // the withdrawal preview follows the amount as it is typed
  if (el.dataset.preview !== 'withdraw') return;
  const amount = Math.floor(Number(el.value));
  $('#withdraw-preview').textContent = amount > 0 ? `${listInstruction(amount)} on the global market.` : `For example, 100 gold: ${listInstruction(100).replace(/^List/, 'list')}.`;
});

// ---------- start ----------

/** A signed-in page load gives the watcher a chance to look; it looks at most once a minute anyway. */
async function nudgeWatcher() {
  try {
    if (Date.now() - Number(localStorage.getItem('watcherNudge') || 0) < 60_000) return;
    localStorage.setItem('watcherNudge', String(Date.now()));
  } catch { /* no storage: nudge anyway */ }
  const r = await data.watcher('tick');
  if (r.ok && r.looked) await refresh();
}

window.addEventListener('hashchange', render);
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(() => void refresh(), 0);
});
setInterval(tick, 1000);
setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
void refresh().then(() => (state.session ? nudgeWatcher() : undefined));
