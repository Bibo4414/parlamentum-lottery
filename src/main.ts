// The lottery page: what used to be index.html's inline script, now typed. Same behaviour, same Supabase calls.
import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './lib/config.ts';
import type { Database, Tables } from './database.types.ts';
import { verifyDraw } from './lib/verify.ts';

type LotteryId = 'mini' | 'grand';
type Game = Pick<Tables<'lottery_games'>, 'id' | 'name' | 'jackpot' | 'ticket_price' | 'sales_open' | 'draw_at' | 'current_draw_id'>;
type Profile = Pick<Tables<'player_profiles'>, 'user_id' | 'username' | 'gold'>;
type Ticket = Pick<Tables<'lottery_tickets'>, 'id' | 'ticket_number' | 'draw_id' | 'created_at'>;
type Winner = Pick<Tables<'draw_history'>, 'id' | 'winner_username' | 'prize_gold' | 'drawn_at' | 'lottery_id' | 'ticket_number' | 'draw_id'>;
type Deposit = Pick<Tables<'deposit_requests'>, 'id' | 'amount' | 'status' | 'created_at'>;
type Request = Pick<Tables<'withdrawal_requests'>, 'id' | 'user_id' | 'amount' | 'status' | 'created_at'>;
type Named = { player_profiles: { username: string } };
/** The deposit terms everyone sees (deposit_info), and whether the watcher credits deposits by itself right now. */
type DepositInfo = { house_name: string; item: string; item_label: string; tier: string | null; price_cents: number; export_tax_pct: number; import_tax_pct: number; automatic: boolean };
type WatchSale = { id: string; kind: 'market' | 'contract'; at: string; units: number | null; gross_cents: number; tax_cents: number; gold: number; name: string; state: 'open' | 'deposit' | 'other'; reason: string | null };
/** The organizer's view of the watcher (admin_watcher_status): never the login itself. */
type WatchView = { on: boolean; error: string | null; ok_at: string | null; login_ends: string | null; since: string | null; listing: { remaining: number; endsAt: string } | null; sales: WatchSale[] };

const LOTTERIES: Record<LotteryId, { name: string; jackpot: number; ticketPrice: number }> = {
  mini: { name: 'Mini Lottery', jackpot: 0, ticketPrice: 10 },
  grand: { name: 'Grand Lottery', jackpot: 500, ticketPrice: 50 },
};
const isLotteryId = (id: string | undefined): id is LotteryId => id === 'mini' || id === 'grand';
let menuPriceMini = 10, menuPriceGrand = 50;
let currentLottery: LotteryId | null = null;

/** The page's elements: markup that's missing is a bug in index.html, so it fails loudly. */
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
}
const input = (id: string) => $<HTMLInputElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);
const fmt = (n: unknown) => Number(n || 0).toLocaleString();
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let session: Session | null = null, profile: Profile | null = null, isAdmin = false, settings: Game | null = null;
let myTickets: Ticket[] = [], history: Winner[] = [], myWithdrawals: Deposit[] = [], commitment: string | null = null;
let pendingWithdrawals: (Request & Named)[] = [], auditMessages: (Request & Named & { kind: 'deposit' })[] = [], myDeposits: Deposit[] = [];
let menuJackpotMini = 0, menuJackpotGrand = 500;
let depositInfo: DepositInfo | null = null, watchView: WatchView | null = null;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string) {
  const el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = 'none'), 3200);
}
function setText(id: string, value: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function currentName() { return profile?.username || ''; }
function lotteryLabel(id: string | null) { return id === 'mini' ? 'Mini Lottery' : id === 'grand' ? 'Grand Lottery' : 'Earlier draw'; }
function pool() { return Number(settings?.jackpot ?? (currentLottery ? LOTTERIES[currentLottery].jackpot : 0)); }
function salesClosed() {
  return settings?.sales_open === false || (!!settings?.draw_at && new Date(settings.draw_at).getTime() <= Date.now());
}
const activePrice = () => Number(settings?.ticket_price ?? (currentLottery === 'mini' ? menuPriceMini : menuPriceGrand));

async function refreshData() {
  // Fetch independent Supabase data together so changing lotteries feels faster.
  const { data: { session: s } } = await supabase.auth.getSession();
  session = s;

  const selectedGamePromise = currentLottery
    ? supabase.from('lottery_games').select('id,name,jackpot,ticket_price,sales_open,draw_at,current_draw_id').eq('id', currentLottery).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const menuGamesPromise = supabase.from('lottery_games').select('id,jackpot,ticket_price');
  const historyPromise = supabase.from('draw_history').select('id,winner_username,prize_gold,drawn_at,lottery_id,ticket_number,draw_id').order('drawn_at', { ascending: false }).limit(20);
  const profilePromise = session
    ? supabase.from('player_profiles').select('user_id,username,gold').eq('user_id', session.user.id).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const adminPromise = session ? supabase.rpc('is_lottery_admin') : Promise.resolve({ data: false, error: null });

  const [gameResult, menuResult, historyResult, profileResult, adminResult] = await Promise.all([
    selectedGamePromise, menuGamesPromise, historyPromise, profilePromise, adminPromise,
  ]);
  if (adminResult.data === true) {
    const feeResult = await supabase.rpc('admin_get_fee_earnings');
    if (!feeResult.error) setText('adminFeeEarnings', fmt(feeResult.data || 0));
  }
  if (!gameResult.error) settings = gameResult.data || null; else { settings = null; console.error(gameResult.error); }
  if (menuResult.data) {
    menuResult.data.forEach((g) => {
      if (g.id === 'mini') { menuJackpotMini = Number(g.jackpot); menuPriceMini = Number(g.ticket_price) || 10; }
      if (g.id === 'grand') { menuJackpotGrand = Number(g.jackpot); menuPriceGrand = Number(g.ticket_price) || 50; }
    });
  } else if (menuResult.error) console.warn('Lottery menu jackpot values could not be loaded yet.', menuResult.error);
  if (!profileResult.error) profile = profileResult.data || null; else { profile = null; console.error(profileResult.error); }
  isAdmin = !adminResult.error && !!adminResult.data;
  if (adminResult.error) console.error(adminResult.error);
  history = !historyResult.error ? historyResult.data || [] : [];
  if (historyResult.error) console.error(historyResult.error);
  myTickets = []; pendingWithdrawals = []; auditMessages = []; myDeposits = []; myWithdrawals = []; commitment = null;
  if (session) {
    const [myDep, myOut] = await Promise.all([
      supabase.from('deposit_requests').select('id,amount,status,created_at').eq('user_id', session.user.id).eq('status', 'pending').order('created_at'),
      supabase.from('withdrawal_requests').select('id,amount,status,created_at').eq('user_id', session.user.id).eq('status', 'pending').order('created_at'),
    ]);
    if (!myDep.error) myDeposits = myDep.data || []; else console.error(myDep.error);
    if (!myOut.error) myWithdrawals = myOut.data || []; else console.error(myOut.error);
  }
  const terms = await supabase.rpc('deposit_info');
  if (!terms.error) depositInfo = terms.data as DepositInfo | null; else console.error(terms.error);
  watchView = null;
  if (isAdmin) {
    const view = await supabase.rpc('admin_watcher_status');
    if (!view.error) watchView = view.data as WatchView | null; else console.error(view.error);
  }
  if (settings?.current_draw_id) {
    // the open draw's commitment: the SHA-256 of the seed it will be drawn with, published before anyone knows the result
    const open = await supabase.from('lottery_draws').select('seed_hash').eq('id', settings.current_draw_id).maybeSingle();
    if (!open.error) commitment = open.data?.seed_hash ?? null; else console.error(open.error);
  }

  const ticketsPromise = session && currentLottery && settings?.current_draw_id
    ? supabase.from('lottery_tickets').select('id,ticket_number,draw_id,created_at').eq('user_id', session.user.id).eq('draw_id', settings.current_draw_id).eq('lottery_id', currentLottery).order('ticket_number')
    : Promise.resolve({ data: [], error: null });
  const withdrawalsPromise = session && isAdmin
    ? supabase.from('withdrawal_requests').select('id,user_id,amount,status,created_at').eq('status', 'pending').order('created_at')
    : Promise.resolve({ data: [], error: null });
  const depositsPromise = session && isAdmin
    ? supabase.from('deposit_requests').select('id,user_id,amount,status,created_at').eq('status', 'pending').order('created_at')
    : Promise.resolve({ data: [], error: null });
  const [ticketsResult, withdrawalsResult, depositsResult] = await Promise.all([ticketsPromise, withdrawalsPromise, depositsPromise]);
  if (!ticketsResult.error) myTickets = ticketsResult.data || []; else console.error(ticketsResult.error);

  async function attachUsernames(rows: { user_id: string }[]): Promise<Record<string, string>> {
    const ids = [...new Set((rows || []).map((x) => x.user_id))];
    if (!ids.length) return {};
    const { data, error } = await supabase.from('player_profiles').select('user_id,username').in('user_id', ids);
    if (error) { console.error(error); return {}; }
    const names: Record<string, string> = {};
    (data || []).forEach((x) => (names[x.user_id] = x.username));
    return names;
  }
  if (!withdrawalsResult.error) {
    const rows = withdrawalsResult.data || [], names = await attachUsernames(rows);
    pendingWithdrawals = rows.map((x) => ({ ...x, player_profiles: { username: names[x.user_id] || 'Player' } }));
  } else console.error(withdrawalsResult.error);
  if (!depositsResult.error) {
    const rows = depositsResult.data || [], names = await attachUsernames(rows);
    auditMessages = rows.map((x) => ({ kind: 'deposit' as const, ...x, player_profiles: { username: names[x.user_id] || 'Player' } }));
  } else console.error(depositsResult.error);
  render();
}

function purchaseTotalText() {
  const qty = Number($<HTMLSelectElement>('quantity').value || 1), baseTotal = activePrice() * qty, fee = Math.ceil(baseTotal * 0.1);
  return currentLottery
    ? `${fmt(baseTotal)} gold tickets + ${fmt(fee)} gold 10% fee = ${fmt(baseTotal + fee)} gold total.`
    : 'Choose Mini or Grand to see the total including the 10% fee.';
}

function render() {
  const name = currentName(), balance = Number(profile?.gold || 0), closed = salesClosed();
  const activeTicketPrice = activePrice();
  setText('selectedLotteryName', currentLottery ? LOTTERIES[currentLottery].name : 'Choose a lottery');
  setText('selectedTicketPrice', currentLottery ? fmt(activeTicketPrice) + ' gold / ticket' : '');
  setText('howTicketPrice', currentLottery ? fmt(activeTicketPrice) + ' gold' : 'Choose a lottery');
  setText('menuJackpot100', fmt(menuJackpotMini)); setText('menuJackpot500', fmt(menuJackpotGrand));
  setText('menuPriceMini', fmt(menuPriceMini)); setText('menuPriceGrand', fmt(menuPriceGrand));
  setText('adminCurrentTicketPrice', currentLottery ? fmt(activeTicketPrice) : '—');
  setText('balance', fmt(balance)); setText('topGoldBalance', fmt(balance)); setText('pool', fmt(pool())); setText('adminCurrentPool', fmt(pool()));
  setText('purchaseTotalEstimate', purchaseTotalText());
  setText('menuJackpot100', fmt(currentLottery === 'mini' ? pool() : menuJackpotMini));
  setText('menuJackpot500', fmt(currentLottery === 'grand' ? pool() : menuJackpotGrand));
  setText('ticketCount', fmt(myTickets.length)); setText('playerCount', '—'); setText('drawStatus', closed ? 'Closed' : 'Open');
  setText('salesStatusLabel', settings?.sales_open === false ? 'Closed' : 'Open');
  $('accountLoginFields').classList.toggle('hidden', !!session); $('accountIntro').classList.toggle('hidden', !!session);
  $('createAccountBtn').classList.toggle('hidden', !!session); $('loginBtn').classList.toggle('hidden', !!session); $('logoutBtn').classList.toggle('hidden', !session);
  $('accountHeading').textContent = session ? '👤 Account' : '🔐 Account access';
  setText('accountStatus', session ? `Logged in as ${name || session.user.email}. Your balance and tickets are stored online.` : 'Create an account or log in with your username and password. Email is optional.');
  setText('purchaseLoginNotice', session ? 'You are logged in and can buy tickets using this account balance.' : 'Log in above to buy tickets. Your tickets and balance are stored online.');
  input('accountUsername').disabled = !!session; input('accountEmail').disabled = !!session; input('accountPassword').disabled = !!session;
  button('requestWithdrawBtn').disabled = !session; button('requestDepositBtn').disabled = !session || myDeposits.length >= 3;
  setText('depositStatus', !session ? 'Log in to request a deposit.' : myDeposits.length >= 3 ? 'You have 3 pending requests. Wait for one to be approved before sending another.' : `You have ${myDeposits.length} of 3 pending requests.`);
  $('myPendingDeposits').innerHTML = myDeposits.map((d) => `<div class="entry"><span>Pending · ${fmt(d.amount)} gold · ${esc(new Date(d.created_at).toLocaleString())}</span><span>Waiting for approval</span></div>`).join('');
  setText('withdrawStatus', !session ? 'Log in to request a withdrawal.' : myWithdrawals.length >= 3 ? 'You have 3 withdrawals waiting. Wait for one to be paid before asking for another.' : 'Your withdrawal request will be held while I review it.');
  button('requestWithdrawBtn').disabled = !session || myWithdrawals.length >= 3;
  $('myPendingWithdrawals').innerHTML = myWithdrawals.map((w) => `<div class="entry"><span>Waiting · ${fmt(w.amount)} gold · ${esc(new Date(w.created_at).toLocaleString())}</span><span>${esc(listInstruction(w.amount))}</span></div>`).join('');
  setText('drawCommitment', commitment ? `Seed fingerprint (SHA-256): ${commitment}` : '');
  renderDepositTerms();
  button('buyBtn').disabled = !session || closed || !currentLottery; $<HTMLSelectElement>('quantity').disabled = !session || closed || !currentLottery;
  $('lotteryMenu').classList.toggle('hidden', !!currentLottery); $('lotteryGameArea').classList.toggle('hidden', !currentLottery);
  $('myTickets').innerHTML = myTickets.length
    ? myTickets.map((t) => `<span class="ticket">#${fmt(t.ticket_number)}</span>`).join('')
    : `<div class="empty">${session ? 'No tickets for this account in the current draw.' : 'Log in to view your tickets.'}</div>`;
  $('recentEntries').innerHTML = myTickets.length
    ? [...myTickets].reverse().slice(0, 8).map((t) => `<div class="entry"><span>Your ticket</span><span>#${fmt(t.ticket_number)}</span></div>`).join('')
    : '<div class="empty">No visible ticket entries yet.</div>';
  $('pastWinners').innerHTML = history.length
    ? history.map((d) => `<div class="history-item"><div><strong>Winner: ${esc(d.winner_username || 'Unknown')}</strong></div><div class="hint">${esc(lotteryLabel(d.lottery_id))}${d.ticket_number ? ' · Ticket #' + fmt(d.ticket_number) : ''}</div><div class="hint">Prize: ${fmt(d.prize_gold)} gold · ${esc(d.drawn_at ? new Date(d.drawn_at).toLocaleString() : 'Date unavailable')}</div>${d.draw_id ? `<button class="btn secondary" type="button" data-check-draw="${d.draw_id}">Check this draw</button><div class="verify" data-verdict="${d.draw_id}"></div>` : ''}</div>`).join('')
    : '<div class="empty">No completed draws yet.</div>';
  $('pastWinners').querySelectorAll<HTMLElement>('[data-check-draw]').forEach((b) => b.addEventListener('click', () => checkDraw(Number(b.dataset.checkDraw))));
  const latest = history[0];
  $('winnerDisplay').innerHTML = latest
    ? `<div class="winner"><div class="eyebrow">Most recent winner</div><strong>${esc(latest.winner_username || 'Unknown')}</strong><div class="hint">${esc(lotteryLabel(latest.lottery_id))}${latest.ticket_number ? ' · Ticket #' + fmt(latest.ticket_number) : ''}</div><div class="hint">Prize: ${fmt(latest.prize_gold)} gold (paid automatically)</div></div>`
    : '<div class="empty">No winner drawn yet.</div>';
  $('countdown').textContent = settings?.draw_at ? (new Date(settings.draw_at).getTime() <= Date.now() ? 'Draw time reached' : new Date(settings.draw_at).toLocaleString()) : 'No draw scheduled';
  $('drawDateLabel').textContent = settings?.draw_at ? 'Scheduled for ' + new Date(settings.draw_at).toLocaleString() : 'I haven’t set a draw time yet.';
  $('adminProtectedControls').classList.toggle('hidden', !isAdmin); $('unlockAdminBtn').classList.toggle('hidden', isAdmin); $('lockAdminBtn').classList.toggle('hidden', !isAdmin);
  $('adminCode').closest('.field')?.classList.add('hidden');
  if (isAdmin) renderWatcher();
  if (isAdmin) {
    $('pendingWithdrawalsList').innerHTML = pendingWithdrawals.length
      ? pendingWithdrawals.map((w) => `<div class="pending-withdrawal"><strong>${esc(w.player_profiles?.username || 'Player')}</strong> requested <strong>${fmt(w.amount)} gold</strong><div class="hint">Request #${w.id} · ${esc(new Date(w.created_at).toLocaleString())}</div><div class="hint">Tell the player: ${esc(listInstruction(w.amount))} on the global market.</div><div class="pending-actions"><button class="btn goldbtn" data-withdraw="${w.id}" data-approve="true">Mark completed</button><button class="btn secondary" data-withdraw="${w.id}" data-approve="false">Reject & refund</button></div></div>`).join('')
      : '<div class="empty">No pending withdrawals. If requests exist but are not shown, run the admin read-policy SQL I provide separately.</div>';
    $('pendingWithdrawalsList').querySelectorAll<HTMLElement>('[data-withdraw]').forEach((b) => b.addEventListener('click', () => processWithdrawal(Number(b.dataset.withdraw), b.dataset.approve === 'true')));
    $('auditLog').innerHTML = auditMessages.length
      ? auditMessages.map((d) => `<div class="entry"><span><strong>${esc(d.player_profiles?.username || 'Player')}</strong> paid for <strong>${fmt(d.amount)} gold</strong> · request #${d.id} · ${esc(new Date(d.created_at).toLocaleString())}</span><span><button class="btn goldbtn" data-deposit="${d.id}" data-approve="true">Mark paid &amp; credit gold</button> <button class="btn secondary" data-deposit="${d.id}" data-approve="false">Reject</button></span></div>`).join('')
      : '<div class="empty">No pending deposits.</div>';
    $('auditLog').querySelectorAll<HTMLElement>('[data-deposit]').forEach((b) => b.addEventListener('click', () => processDeposit(Number(b.dataset.deposit), b.dataset.approve === 'true')));
  } else {
    $('pendingWithdrawalsList').innerHTML = '<div class="empty">Organizer sign-in required.</div>';
    $('auditLog').innerHTML = '<div class="empty">Organizer sign-in required.</div>';
  }
  button('drawBtn').disabled = !isAdmin || !currentLottery; button('reopenBtn').disabled = !isAdmin || !currentLottery; button('resetBtn').disabled = !isAdmin;
  button('scheduleBtn').disabled = !isAdmin || !currentLottery; button('clearScheduleBtn').disabled = !isAdmin || !currentLottery;
  button('openSalesBtn').disabled = !isAdmin || !currentLottery; button('closeSalesBtn').disabled = !isAdmin || !currentLottery;
  if (settings?.draw_at) { const d = new Date(settings.draw_at); input('drawDateInput').value = d.toISOString().slice(0, 16); } else input('drawDateInput').value = '';
}

/** Re-does a finished draw in the browser from what was published, and says whether it holds up. */
async function checkDraw(drawId: number) {
  const out = $('pastWinners').querySelector<HTMLElement>(`[data-verdict="${drawId}"]`);
  if (!out) return;
  out.textContent = 'Checking…';
  const [draw, entries] = await Promise.all([
    supabase.from('lottery_draws').select('id,seed_hash,seed,tickets_digest,ticket_count,winning_index,winning_ticket').eq('id', drawId).maybeSingle(),
    supabase.rpc('draw_tickets', { p_draw_id: drawId }),
  ]);
  if (draw.error || entries.error || !draw.data) { out.textContent = 'This draw couldn’t be loaded.'; return; }
  const verdict = await verifyDraw(draw.data, entries.data ?? []);
  out.innerHTML = `<strong class="${verdict.ok ? 'ok' : 'bad'}">${verdict.ok ? `Checked: ticket #${fmt(verdict.ticket)} (${esc(verdict.winner)}) won fairly.` : 'This draw does not check out.'}</strong>`
    + `<ul>${verdict.checks.map((c) => `<li class="${c.ok ? 'ok' : 'bad'}">${c.ok ? '✓' : '✗'} ${esc(c.label)}</li>`).join('')}</ul>`
    + (draw.data.seed ? `<div class="commitment">Seed: ${esc(draw.data.seed)}<br>Fingerprint: ${esc(draw.data.seed_hash)}</div>` : '');
}

// ---------- deposits, withdrawals and the watcher ----------

const goldOf = (cents: number) => (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** What 100 units at the deposit price credit: the House's receipts after its export tax, in whole gold. */
function creditFor100(info: DepositInfo) {
  const gross = 100 * info.price_cents, tax = info.export_tax_pct > 0 ? Math.max(1, Math.floor((gross * info.export_tax_pct) / 100)) : 0;
  return Math.floor((gross - tax) / 100);
}
/** A withdrawal of `amount` gold: the player lists one unit at amount ÷ (1 + the House's import tax), so the House
 *  pays the amount in all, tax included. */
function listInstruction(amount: number) {
  const label = depositInfo?.item_label ?? 'Raw Copper', tax = depositInfo?.import_tax_pct ?? 0;
  return `List 1 ${label} for ${goldOf(Math.floor((amount * 10000) / (100 + tax)))} gold`;
}

function renderDepositTerms() {
  const info = depositInfo;
  if (!info) return;
  const price = goldOf(info.price_cents), item = `${info.item_label}${info.tier ? ` (${info.tier})` : ''}`;
  setText('depositHow', `Buy ${item} from ${info.house_name} on the global market at ${price} gold a unit. You're credited what ${info.house_name} receives after the game's tax, in whole gold: 100 units make ${fmt(creditFor100(info))} gold.`);
  setText('depositAfter', info.automatic
    ? 'Deposits are credited automatically within a few minutes, to the lottery account with your Parlamentum name. Telling us the amount below is optional.'
    : 'After you buy, enter the same amount below. I\'ll check the trade and approve it, and the gold is added to your balance. You can have up to 3 pending requests at a time.');
  if (document.activeElement?.closest('.watcher-terms')) return;
  input('termHouse').value = info.house_name; input('termLabel').value = info.item_label; input('termItem').value = info.item;
  input('termTier').value = info.tier ?? ''; input('termPrice').value = (info.price_cents / 100).toFixed(2);
  input('termExport').value = String(info.export_tax_pct); input('termImport').value = String(info.import_tax_pct);
  setText('termEffect', `At these terms 100 units credit ${fmt(creditFor100(info))} gold; a withdrawal of 100 is listed at ${listInstruction(100).replace(/^List 1 .* for /, '')}.`);
}

const utc = (iso: string) => iso.slice(0, 16).replace('T', ' ') + ' UTC';
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60_000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

/** What needs the organizer: a login about to run out, a deposit listing low, ending or gone, or no good look lately. */
function watcherWarnings(view: WatchView, info: DepositInfo | null): string[] {
  const out: string[] = [], now = Date.now();
  if (!view.on) return out;
  if (view.login_ends) {
    const ends = Date.parse(view.login_ends);
    if (ends <= now) out.push('The game login has run out: paste a fresh one.');
    else if (ends - now < 2 * 86_400_000) out.push(`The game login runs out ${utc(view.login_ends)}: paste a fresh one before then.`);
  }
  if (view.ok_at && !view.error) {
    if (!view.listing) out.push(`No ${info?.item_label ?? 'deposit item'} listed at ${info ? goldOf(info.price_cents) : 'the deposit price'}: players can't deposit until you list some.`);
    else {
      if (view.listing.remaining < 200) out.push(`Only ${fmt(view.listing.remaining)} left on the deposit listing.`);
      if (Date.parse(view.listing.endsAt) - now < 12 * 3_600_000) out.push(`The deposit listing ends ${utc(view.listing.endsAt)}.`);
    }
  }
  if (view.ok_at && now - Date.parse(view.ok_at) > 3_600_000) out.push(`No good look at the game since ${utc(view.ok_at)}.`);
  return out;
}

function renderWatcher() {
  const view = watchView;
  if (!view) return;
  const badge = $('watcherBadge');
  badge.textContent = view.on ? (view.error ? 'On, failing' : 'On') : 'Off';
  badge.className = `watcher-badge ${view.on ? (view.error ? 'bad' : 'on') : ''}`;
  $('watcherFacts').innerHTML = view.on
    ? [['Last good look', view.ok_at ? ago(view.ok_at) : 'not yet'], ['Login runs out', view.login_ends ? utc(view.login_ends) : 'unknown'],
       ['Deposit listing', view.listing ? `${fmt(view.listing.remaining)} left` : 'none seen'], ['Crediting since', view.since ? utc(view.since) : '–']]
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')
    : '';
  $('watcherError').classList.toggle('hidden', !view.error);
  setText('watcherError', view.error ?? '');
  $('watcherWarnings').innerHTML = watcherWarnings(view, depositInfo).map((w) => `<li>${esc(w)}</li>`).join('');
  setText('watcherTokenLabel', view.on ? 'Replace the game login' : 'House game login');
  setText('watcherLoginBtn', view.on ? 'Save new login' : 'Turn the watcher on');
  $('watcherLookBtn').classList.toggle('hidden', !view.on); $('watcherStopBtn').classList.toggle('hidden', !view.on);
  const label = depositInfo?.item_label ?? 'Raw Copper';
  $('watcherSales').innerHTML = view.sales.length
    ? view.sales.map((s) => {
        const what = s.kind === 'market' ? `bought ${fmt(s.units)} ${label} for ${goldOf(s.gross_cents)}` : `sent ${goldOf(s.gross_cents)} by contract`;
        const state = s.state === 'deposit' ? (s.reason === 'paid by hand' ? 'Already paid by hand' : `Credited +${fmt(s.gold)}`) : s.state === 'open' ? 'Waiting' : `Not a deposit: ${s.reason ?? 'unknown'}`;
        return `<div class="entry"><span><strong>${esc(s.name)}</strong> ${esc(what)} · ${esc(utc(s.at))}</span><span>${esc(state)}</span></div>`;
      }).join('')
    : '<div class="empty">Nothing yet.</div>';
}

/** Calls the watcher's edge function with the signed-in user's session. */
async function watcher(action: string, extra: Record<string, unknown> = {}): Promise<{ message?: string; looked?: boolean } | null> {
  const { data, error } = await supabase.functions.invoke('watcher', { body: { action, ...extra } });
  if (!error) return data as { message?: string; looked?: boolean };
  const res = (error as { context?: Response }).context;
  const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
  toast(body.error || 'The watcher couldn’t be reached.');
  return null;
}

/** Each page load gives the watcher a chance to look (it looks at most once a minute anyway). */
async function nudgeWatcher() {
  try {
    const last = Number(localStorage.getItem('watcherNudge') || 0);
    if (Date.now() - last < 60_000) return;
    localStorage.setItem('watcherNudge', String(Date.now()));
  } catch { /* no storage: nudge anyway */ }
  const { data } = await supabase.functions.invoke('watcher', { body: { action: 'tick' } });
  if ((data as { looked?: boolean } | null)?.looked) await refreshData();
}

const messageOf = (error: unknown) => (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '');
async function showError(error: unknown, fallback = 'Something went wrong.') { console.error(error); toast(messageOf(error) || fallback); }

function usernameAlias(username: string) {
  // Supabase Auth requires an email or phone. This deterministic internal alias lets players use usernames instead.
  // Email confirmation must be disabled in Supabase for these non-deliverable aliases to work.
  let hash = 2166136261;
  for (const ch of username.toLowerCase()) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  const slug = username.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 24);
  return `${slug}.${hash.toString(36)}@players.parlamentum.invalid`;
}

async function createAccount() {
  const username = input('accountUsername').value.trim(), email = input('accountEmail').value.trim(), password = input('accountPassword').value;
  if (!/^[A-Za-z0-9_ -]{3,24}$/.test(username)) { toast('Username must be 3–24 characters (letters, numbers, spaces, _ or -).'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address, or leave it blank.'); return; }
  if (password.length < 8) { toast('Password must be at least 8 characters.'); return; }
  const authEmail = email || usernameAlias(username);
  const { data, error } = await supabase.auth.signUp({ email: authEmail, password, options: { data: { username } } });
  if (error) { await showError(error); return; }
  if (data.session) toast('Account created! You are logged in.');
  else toast('Account created. If email confirmation is enabled in Supabase, turn it off to use username-only accounts.');
  input('accountPassword').value = '';
  await refreshData();
}

async function login() {
  const username = input('accountUsername').value.trim(), email = input('accountEmail').value.trim(), password = input('accountPassword').value;
  if (!username || !password) { toast('Enter your username and password.'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address, or leave it blank to log in by username.'); return; }
  const authEmail = email || usernameAlias(username);
  const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
  if (error) { await showError(error, 'Could not log in. If this is your older organizer account, enter its email in the optional email field.'); return; }
  input('accountPassword').value = '';
  await refreshData();
  toast('Logged in successfully.');
}

async function processWithdrawal(id: number, approve: boolean) {
  const { error } = await supabase.rpc('admin_process_withdrawal', { p_request_id: id, p_approve: approve });
  if (error) { await showError(error); return; }
  toast(approve ? 'Withdrawal marked completed.' : 'Withdrawal rejected and refunded.');
  await refreshData();
}
async function processDeposit(id: number, approve: boolean, force = false) {
  const { error } = await supabase.rpc('admin_process_deposit', { p_request_id: id, p_approve: approve, p_force: force });
  if (error?.message.startsWith('NO_TRADE: ')) {
    if (confirm(error.message.slice('NO_TRADE: '.length))) await processDeposit(id, approve, true);
    return;
  }
  if (error) { await showError(error); return; }
  toast(approve ? 'Deposit approved and gold added.' : 'Deposit rejected.');
  await refreshData();
}

$('openGoldToolsBtn').addEventListener('click', () => {
  $('goldToolsPanel').classList.toggle('hidden');
  if (!$('goldToolsPanel').classList.contains('hidden')) $('goldToolsPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('depositTabBtn').addEventListener('click', () => { $('depositTabContent').classList.remove('hidden'); $('withdrawTabContent').classList.add('hidden'); });
$('withdrawTabBtn').addEventListener('click', () => { $('depositTabContent').classList.add('hidden'); $('withdrawTabContent').classList.remove('hidden'); });
$('createAccountBtn').addEventListener('click', createAccount); $('loginBtn').addEventListener('click', login);
$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  profile = null; session = null; isAdmin = false;
  await refreshData();
  toast('Logged out.');
});
$('requestWithdrawBtn').addEventListener('click', async () => {
  if (!session) { toast('Log in before requesting a withdrawal.'); return; }
  const amount = Number(input('withdrawAmount').value);
  if (!Number.isSafeInteger(amount) || amount < 1) { toast('Enter a whole gold amount of at least 1.'); return; }
  const { error } = await supabase.rpc('request_lottery_withdrawal', { p_amount: amount });
  if (error) { await showError(error); return; }
  input('withdrawAmount').value = '';
  toast(`Withdrawal requested. ${listInstruction(amount)} on the global market.`);
  await refreshData();
});
$('requestDepositBtn').addEventListener('click', async () => {
  if (!session) { toast('Log in before requesting a deposit.'); return; }
  const amount = Number(input('depositAmount').value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) { toast('Enter a whole amount from 1 to 1,000,000.'); return; }
  const { error } = await supabase.rpc('request_lottery_deposit', { p_amount: amount });
  if (error) { await showError(error); return; }
  input('depositAmount').value = '';
  toast(`Deposit request for ${fmt(amount)} gold sent. I'll approve it after I verify the trade.`);
  await refreshData();
});
$('buyBtn').addEventListener('click', async () => {
  if (!session) { toast('Create an account or log in first.'); return; }
  if (!currentLottery) { toast('Choose Mini or Grand Lottery first.'); return; }
  const quantity = Number($<HTMLSelectElement>('quantity').value);
  const { data, error } = await supabase.rpc('buy_lottery_tickets', { p_quantity: quantity, p_lottery_id: currentLottery });
  if (error) { await showError(error); return; }
  toast(`Purchased ${Array.isArray(data) ? data.length : quantity} ticket(s)! 10% organizer fee included. Good luck.`);
  await refreshData();
});
$('quantity').addEventListener('change', () => setText('purchaseTotalEstimate', purchaseTotalText()));
document.querySelectorAll<HTMLElement>('[data-lottery]').forEach((btn) => btn.addEventListener('click', async () => {
  const id = btn.dataset.lottery;
  if (!isLotteryId(id)) return;
  currentLottery = id; settings = null; myTickets = [];
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await refreshData();
}));
$('backToMenuBtn').addEventListener('click', () => {
  currentLottery = null; settings = null; myTickets = [];
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshData();
});
$('refreshBtn').addEventListener('click', async () => { await refreshData(); toast('Display refreshed.'); });
$('unlockAdminBtn').addEventListener('click', async () => {
  await refreshData();
  if (!isAdmin) toast('This signed-in account is not registered as an organizer in Supabase.');
  else toast('My organizer controls are unlocked.');
});
$('lockAdminBtn').addEventListener('click', () => { isAdmin = false; render(); toast('Organizer controls locked.'); });
$('addCreditsBtn').addEventListener('click', async () => {
  if (!isAdmin) { toast('Sign in with my organizer account first.'); return; }
  const username = input('creditUser').value.trim(), amount = Number(input('creditAmount').value);
  if (!username || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) { toast('Enter a username and a whole amount from 1 to 1,000,000.'); return; }
  const { error } = await supabase.rpc('admin_credit_gold', { p_username: username, p_amount: amount });
  if (error) { await showError(error); return; }
  toast(`Added ${fmt(amount)} gold to ${username}.`);
  await refreshData();
});
$('setTicketPriceBtn').addEventListener('click', async () => {
  if (!isAdmin) { toast('Organizer sign-in required.'); return; }
  if (!currentLottery) { toast('Open Mini or Grand Lottery first.'); return; }
  const amount = Number(input('ticketPriceInput').value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) { toast('Enter a whole ticket price from 1 to 1,000,000 gold.'); return; }
  const { error } = await supabase.rpc('admin_set_ticket_price', { p_ticket_price: amount, p_lottery_id: currentLottery });
  if (error) { await showError(error, 'Could not save ticket price. Run the ticket-price SQL setup in Supabase first.'); return; }
  toast('Ticket price updated.');
  input('ticketPriceInput').value = '';
  await refreshData();
});
$('setPrizePoolBtn').addEventListener('click', async () => {
  if (!isAdmin) return;
  const amount = Number(input('prizePoolInput').value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) { toast('Enter a valid whole jackpot amount.'); return; }
  // as before: with no lottery open the call goes out without one and the database refuses it
  const { error } = await supabase.rpc('admin_set_jackpot', { p_amount: amount, p_lottery_id: currentLottery as string });
  if (error) { await showError(error); return; }
  toast('Jackpot updated.');
  await refreshData();
});
$('resetPrizePoolBtn').addEventListener('click', async () => {
  if (!isAdmin) { toast('Organizer sign-in required.'); return; }
  if (!currentLottery) { toast('Choose a lottery first.'); return; }
  const btn = button('resetPrizePoolBtn');
  btn.disabled = true;
  try {
    const { error } = await supabase.rpc('admin_reset_jackpot_to_ticket_total', { p_lottery_id: currentLottery });
    if (error) { await showError(error); return; }
    toast('Prize pool reset to ticket sales total.');
    await refreshData();
  } finally { btn.disabled = false; }
});
async function setSalesOpen(open: boolean) {
  if (!isAdmin) { toast('Organizer sign-in required.'); return; }
  const { error } = await supabase.rpc('admin_set_sales_open', { p_open: open, p_lottery_id: currentLottery as string });
  if (error) { await showError(error); return; }
  toast(open ? 'Ticket sales opened.' : 'Ticket sales closed.');
  await refreshData();
}
$('openSalesBtn').addEventListener('click', () => setSalesOpen(true)); $('closeSalesBtn').addEventListener('click', () => setSalesOpen(false));
$('scheduleBtn').addEventListener('click', async () => {
  if (!isAdmin || !currentLottery) { toast('Choose a lottery and sign in as organizer.'); return; }
  const raw = input('drawDateInput').value;
  if (!raw) { toast('Choose a date and time first.'); return; }
  const utcDate = new Date(raw + 'Z');
  if (!Number.isFinite(utcDate.getTime()) || utcDate.getTime() <= Date.now()) { toast('Choose a future UTC date and time.'); return; }
  const { error } = await supabase.rpc('admin_set_draw_time', { p_lottery_id: currentLottery, p_draw_at: utcDate.toISOString() });
  if (error) { await showError(error, 'Could not save draw time. Run the organizer controls SQL setup first.'); return; }
  toast('Draw time saved in UTC.');
  await refreshData();
});
$('clearScheduleBtn').addEventListener('click', async () => {
  if (!isAdmin || !currentLottery) { toast('Choose a lottery and sign in as organizer.'); return; }
  // null clears the time; the generated types don't mark function arguments as nullable
  const { error } = await supabase.rpc('admin_set_draw_time', { p_lottery_id: currentLottery, p_draw_at: null as unknown as string });
  if (error) { await showError(error, 'Could not clear draw time. Run the organizer controls SQL setup first.'); return; }
  toast('Draw time cleared.');
  await refreshData();
});
$('drawBtn').addEventListener('click', async () => {
  if (!isAdmin || !currentLottery) { toast('Choose a lottery and sign in as organizer.'); return; }
  if (!confirm('Randomly draw one winner for this lottery? The jackpot is paid to the winner automatically and a new empty draw starts.')) return;
  const { error } = await supabase.rpc('admin_close_and_draw', { p_lottery_id: currentLottery });
  if (error) { await showError(error, 'Could not draw winner. Run the organizer controls SQL setup first.'); return; }
  toast('Ticket sales closed and winner drawn!');
  await refreshData();
});
$('reopenBtn').addEventListener('click', async () => {
  if (!isAdmin || !currentLottery) { toast('Choose a lottery and sign in as organizer.'); return; }
  if (!confirm('Start a new draw for this lottery? Existing winner history and player balances will be kept.')) return;
  const { error } = await supabase.rpc('admin_reopen_draw', { p_lottery_id: currentLottery });
  if (error) { await showError(error, 'Could not open the next draw. Run the organizer controls SQL setup first.'); return; }
  toast('A new draw is open.');
  await refreshData();
});
$('deleteAllTicketsBtn').addEventListener('click', async () => {
  if (!isAdmin) { toast('Organizer sign-in required.'); return; }
  if (!confirm('Cancel every ticket in both open draws? Each player gets back what they paid, price and fee, and the ticket money leaves the pools. Past winners are kept.')) return;
  const btn = button('deleteAllTicketsBtn');
  btn.disabled = true;
  try {
    const { error } = await supabase.rpc('admin_delete_all_lottery_tickets');
    if (error) { await showError(error, 'Could not delete tickets. Run the updated organizer controls SQL setup first.'); return; }
    toast('All open tickets cancelled and refunded. Past winners kept.');
    await refreshData();
  } finally { btn.disabled = false; }
});
$('resetBtn').addEventListener('click', async () => {
  if (!isAdmin) { toast('Organizer sign-in required.'); return; }
  if (!confirm('Restart both draws? Every ticket in them is refunded, price and fee, and fresh draws start at the seed (Mini 0, Grand 500). Past winners are kept.')) return;
  const { error } = await supabase.rpc('admin_reset_lottery_data');
  if (error) { await showError(error, 'Could not reset data. Run the organizer controls SQL setup first.'); return; }
  currentLottery = null; settings = null;
  toast('Both draws restarted. Tickets refunded, past winners kept.');
  await refreshData();
});
$('watcherLoginBtn').addEventListener('click', async () => {
  const token = input('watcherToken').value.trim();
  if (!token) { toast('Paste the House’s game login first.'); return; }
  const done = await watcher('login', { token });
  input('watcherToken').value = '';
  if (done?.message) toast(done.message);
  await refreshData();
});
$('watcherLookBtn').addEventListener('click', async () => { const done = await watcher('look'); if (done) toast('Looked at the game.'); await refreshData(); });
$('watcherStopBtn').addEventListener('click', async () => {
  if (!confirm('Turn the watcher off? Its login is forgotten and deposits are approved by hand again.')) return;
  const done = await watcher('stop');
  if (done?.message) toast(done.message);
  await refreshData();
});
$('saveTermsBtn').addEventListener('click', async () => {
  const price = Math.round(Number(input('termPrice').value) * 100), exportTax = Number(input('termExport').value), importTax = Number(input('termImport').value);
  if (!Number.isSafeInteger(price) || price < 1) { toast('Enter a deposit price such as 1.12.'); return; }
  const { error } = await supabase.rpc('admin_set_deposit_terms', {
    p_house_name: input('termHouse').value, p_item: input('termItem').value, p_item_label: input('termLabel').value, p_tier: input('termTier').value,
    p_price_cents: price, p_export_tax_pct: exportTax, p_import_tax_pct: importTax,
  });
  if (error) { await showError(error, 'Check the terms: item codes are like COPPER_RAW, taxes 0 to 50%.'); return; }
  toast('Deposit terms saved.');
  await refreshData();
});
$('lookupBtn').addEventListener('click', () => toast('Player lookup needs a secure organizer lookup function to be added in Supabase first.'));
supabase.auth.onAuthStateChange((_event, newSession) => { session = newSession; setTimeout(() => refreshData(), 0); });
refreshData()
  .then(() => (session ? nudgeWatcher() : undefined))
  .catch((e) => showError(e, 'Could not connect to Supabase. Check the project URL and publishable key.'));
