// What the lottery's House keeps and what it risks, worked out exactly where it can be and checked by simulation.
// Plain Node 22, no packages.   Run: node scripts/odds.mjs            node scripts/odds.mjs --help lists the settings
//
// The rules (supabase/migrations): a purchase is 1 to 10 tickets. The player pays each ticket's price plus the fee,
// fee% of the purchase rounded up to whole gold. The prices go into that raffle's pool, the fee to the House. A draw
// picks one ticket at random and its owner gets the whole pool; the next pool starts at the seed, which the House pays.
// No tickets, no draw. So the House's result for a draw is its fees less the seed, whoever wins. The defaults are the
// settings since commit e48c442: the Mini has no seed (it had 100), the Grand's is 500.
import { parseArgs } from 'node:util';

// ---------- settings: today's, unless a flag says otherwise ----------
const SETTINGS = {
  'mini-price': ['10', 'Mini ticket price, whole gold'],
  'mini-seed': ['0', 'gold the House puts into every new Mini pool (0 since e48c442; it was 100)'],
  'grand-price': ['50', 'Grand ticket price, whole gold'],
  'grand-seed': ['500', 'gold the House puts into every new Grand pool'],
  fee: ['10', 'organizer fee, % of the tickets bought, on top and rounded up per purchase'],
  'export-tax': ['10', "the House's country's export tax, %: it comes out of what the House sells"],
  'import-tax': ['10', "the House's country's import tax, %: paid on top of what the House buys"],
  'deposit-price': ['1.05', 'what a player pays for each gold credited (the Raw Copper listing price)'],
  copper: ['0.08', 'what one Raw Copper handed over on a deposit is worth, in gold (market, 17 Oct 2026)'],
  'draws-per-week': ['2', 'draws of each raffle a week'],
  weeks: ['52', 'weeks in a simulated year'],
  bankroll: ['5000', "the House's own gold at the start of a year, apart from what it holds for players"],
  demand: ['10,30,60,100,200', 'average tickets a draw in each raffle: the levels to try'],
  dispersion: ['2', 'lumpy demand is negative binomial with this shape k (smaller is lumpier)'],
  'per-purchase': ['10', 'tickets a purchase in the simulations (the fee is rounded up per purchase)'],
  'seed-share': ['50', "alternative (a): % of a draw's fees that pays the next seed, at most the seed above"],
  'mini-cap': ['100', '"+ Mini seed": the most a Mini seed paid from its fees may reach (its seed before e48c442)'],
  'min-tickets': ['20,100', 'alternative (b): tickets a draw needs before it goes ahead'],
  rollover: ['200,500', 'alternative (c): the winning number is drawn from 1 to R; these are the Rs'],
  years: ['20000', 'simulated years for each line'],
  rng: ['1', 'random seed for the simulations: the same seed prints the same numbers'],
};
let flags;
try {
  const options = Object.fromEntries(Object.keys(SETTINGS).map((k) => [k, { type: 'string' }]));
  flags = parseArgs({ options: { ...options, help: { type: 'boolean', short: 'h' } } }).values;
} catch (e) {
  console.error(`${e.message}\nnode scripts/odds.mjs --help lists the settings`);
  process.exit(1);
}
if (flags.help) {
  console.log("node scripts/odds.mjs [--setting value ...]   every setting is today's unless given:\n");
  for (const [k, [v, what]] of Object.entries(SETTINGS)) console.log(`  --${k.padEnd(15)} ${v.padEnd(17)} ${what}`);
  process.exit(0);
}
function many(k, ok, wants) {
  return String(flags[k] ?? SETTINGS[k][0]).split(',').map((raw) => {
    const v = Number(raw.trim());
    if (raw.trim() === '' || !Number.isFinite(v) || !ok(v)) { console.error(`--${k} ${flags[k]}: wants ${wants}`); process.exit(1); }
    return v;
  });
}
const one = (k, ok, wants) => { const v = many(k, ok, wants); if (v.length > 1) { console.error(`--${k} takes one value`); process.exit(1); } return v[0]; };
const whole = (lo) => (v) => Number.isInteger(v) && v >= lo;
const rate = (v) => v >= 0 && v < 100;

const FEE_BP = Math.round(one('fee', (v) => v >= 0 && v <= 100, 'a % from 0 to 100') * 100);   // in hundredths of a %
const EXPORT = one('export-tax', rate, 'a % from 0 to under 100') / 100;
const IMPORT = one('import-tax', rate, 'a % from 0 to under 100') / 100;
const DEPOSIT = one('deposit-price', (v) => v > 0, 'a price above 0');
const COPPER = one('copper', (v) => v >= 0, 'a value of 0 or more');
const PER_WEEK = one('draws-per-week', (v) => v > 0, 'a number above 0');
const WEEKS = one('weeks', whole(1), 'a whole number of weeks');
const DRAWS = Math.max(1, Math.round(PER_WEEK * WEEKS));                    // draws of each raffle in a year
const BANKROLL = one('bankroll', (v) => v >= 0, 'gold, 0 or more');
const DEMAND = many('demand', (v) => v > 0, 'averages above 0, e.g. 10,30,60');
const K = one('dispersion', (v) => v > 0, 'a shape above 0');
const PACK = one('per-purchase', (v) => Number.isInteger(v) && v >= 1 && v <= 10, 'a whole number from 1 to 10');
const SHARE = one('seed-share', (v) => v >= 0 && v <= 100, 'a % from 0 to 100') / 100;
const MINI_CAP = one('mini-cap', whole(0), 'whole gold, 0 or more');
const MINS = many('min-tickets', whole(1), 'whole numbers of tickets, e.g. 20,100');
const RS = many('rollover', whole(1), 'whole numbers, e.g. 200,500');
const YEARS = one('years', whole(100), 'a whole number, 100 or more');
const RNG = one('rng', Number.isInteger, 'a whole number');

// ---------- the two raffles ----------
const fee = (gold) => Math.ceil((gold * FEE_BP) / 10000);                   // the fee on one purchase of `gold` in tickets
function raffle(name, key) {
  const price = one(`${key}-price`, whole(1), 'whole gold, 1 or more'), seed = one(`${key}-seed`, whole(0), 'whole gold, 0 or more');
  const feeOf = (q) => fee(price * q);                                        // the fee on one purchase of q tickets
  return { name, price, seed, feeOf, cost1: price + feeOf(1), fees: (n, q = PACK) => Math.floor(n / q) * feeOf(q) + feeOf(n % q) };
}
const RAFFLES = [raffle('Mini', 'mini'), raffle('Grand', 'grand')];

// ---------- numbers for people ----------
const fmt = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const sfmt = (x, d = 0) => { const r = Math.round(x * 10 ** d) / 10 ** d; return r === 0 ? fmt(0, d) : (r > 0 ? '+' : '') + fmt(r, d); };
const g = (x) => fmt(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : 2);         // 1,100 or 10.50
const pc = (x, d = 1) => (Number.isFinite(x) ? `${fmt(x * 100, d)}%` : '-');
const spc = (x, d = 1) => (Number.isFinite(x) ? `${sfmt(x * 100, d)}%` : '-');
const odds = (x) => (x > 0 && x < 0.0005 ? '<0.1%' : pc(x));                // a chance: never shows 0.0% when it isn't 0
const pctOf = (t) => `${fmt(t * 100, Number.isInteger(Math.round(t * 1e6) / 1e4) ? 0 : 2)}%`;   // a tax rate: 5% or 7.50%
const up100 = (x) => Math.ceil(x * 100 - 1e-7) / 100;                        // to the hundredth, as game prices go
const down100 = (x) => Math.floor(x * 100 + 1e-7) / 100;
const row = (cells, widths) => cells.map((c, i) => String(c).padStart(widths[i])).join('');

// ---------- randomness: xoshiro128** seeded by splitmix32, so --rng repeats a run exactly ----------
const rotl = (v, k) => (v << k) | (v >>> (32 - k));
function random(seed) {
  let x = seed >>> 0;
  const mix = () => { x = (x + 0x9e3779b9) >>> 0; let z = Math.imul(x ^ (x >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
  let a = mix(), b = mix(), c = mix(), d = mix();
  const next = () => {
    const out = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0, t = b << 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotl(d, 11);
    return out;
  };
  return () => ((next() >>> 5) * 67108864 + (next() >>> 6)) / 9007199254740992;
}
/** Tickets sold in one draw, as chances by count: Poisson (k = Infinity) or negative binomial with shape k. */
function demand(mean, k) {
  const logs = [];
  let l = k === Infinity ? -mean : k * Math.log(k / (k + mean)), top = -Infinity;
  for (let n = 0; ; n++) {
    logs.push(l); top = Math.max(top, l);
    if (n >= mean && l < top - 45) break;
    l += k === Infinity ? Math.log(mean / (n + 1)) : Math.log(((n + k) / (n + 1)) * (mean / (k + mean)));
  }
  const p = Float64Array.from(logs, (v) => Math.exp(v - top)), sum = p.reduce((s, v) => s + v, 0);
  return p.map((v) => v / sum);
}
/** Draws a count from a table of chances in constant time (Vose's alias method). */
function sampler(p) {
  const n = p.length, keep = new Float64Array(n), other = new Int32Array(n), w = Float64Array.from(p, (v) => v * n), small = [], large = [];
  w.forEach((v, i) => (v < 1 ? small : large).push(i));
  while (small.length && large.length) {
    const s = small.pop(), l = large.pop();
    keep[s] = w[s]; other[s] = l; w[l] += w[s] - 1;
    (w[l] < 1 ? small : large).push(l);
  }
  for (const i of [...small, ...large]) { keep[i] = 1; other[i] = i; }
  return (u) => { const x = u * n, i = x | 0; return x - i < keep[i] ? i : other[i]; };
}
const expect = (p, f) => p.reduce((t, v, n) => t + v * f(n), 0);

// ---------- the settings ----------
console.log('The lottery as it runs today (or as the flags set it)');
console.log(`  ${RAFFLES.map((r) => `${r.name}: ${g(r.price)} gold a ticket, ${r.seed ? `every pool starts at a seed of ${g(r.seed)}` : 'no seed, so every pool starts empty'}`).join('. ')}.`);
console.log(`  The fee is ${pc(FEE_BP / 10000, FEE_BP % 100 ? 2 : 0)} on top, rounded up to whole gold per purchase of 1 to 10 tickets. ${g(PER_WEEK)} draws of each a week.`);
console.log(`  The House's country taxes its exports at ${pctOf(EXPORT)} and its imports at ${pctOf(IMPORT)}. Deposits cost ${DEPOSIT} gold for each gold credited.`);

// ---------- 1. one draw ----------
const SIZES = [1, 2, 3, 5, 10];
console.log('\n1. One draw: the House keeps the fees and pays the seed, whoever wins');
console.log(`   fee on a purchase of${row(SIZES, [6, 6, 6, 6, 6])} tickets`);
for (const r of RAFFLES) {
  const rates = SIZES.map((q) => r.feeOf(q) / (q * r.price)), same = rates.every((x) => Math.abs(x - rates[0]) < 1e-12);
  console.log(`     ${r.name.padEnd(16)}${row(SIZES.map((q) => g(r.feeOf(q))), [6, 6, 6, 6, 6])}          ${same ? `${pc(rates[0])} of the price at every size` : `${rates.map((x) => pc(x)).join(', ')} of the price`}`);
}
console.log(`   one ticket costs ${RAFFLES.map((r) => `${g(r.cost1)} (${r.name})`).join(' and ')}`);
/** Tickets a draw needs for its fees to cover its seed, with every purchase q tickets. */
const breakEven = (r, q) => (r.seed === 0 ? 0 : r.feeOf(q) === 0 ? Infinity : Math.ceil(r.seed / r.feeOf(q)) * q);
console.log('   break-even, the fees covering the seed:');
for (const r of RAFFLES) {
  const [b1, b10] = [breakEven(r, 1), breakEven(r, 10)];
  if (r.seed === 0) console.log(`     ${r.name.padEnd(6)} no seed: the House is ahead on every draw`);
  else if (b1 === Infinity) console.log(`     ${r.name.padEnd(6)} never: there is no fee to cover the seed`);
  else console.log(`     ${r.name.padEnd(6)} ${fmt(b1)} tickets a draw (${fmt(b1 * r.price)} gold of tickets) bought one at a time; ${fmt(b10)} bought ten at a time`);
}
for (const r of RAFFLES) r.even = breakEven(r, 1);

// ---------- 2. a ticket's worth ----------
const NS = [5, 10, 20, 50, 100, 200, 500, 1000];
console.log("\n2. What a ticket is worth to a player: the pool ÷ the draw's tickets, less what it costs");
const w2 = [12, 9, 16, 12, 19, 13, 17];
for (const r of RAFFLES) {
  if (!r.seed) {
    console.log(`   ${r.name}: no seed, so the pool is only the ticket prices. In every draw, whatever its size, players get back`);
    console.log(`   ${pc(r.price / r.cost1)} of what they pay, the House keeps ${pc(r.feeOf(1) / r.cost1)}, and a ticket bought on its own is worth ${sfmt(-r.feeOf(1), 2)}.`);
    continue;
  }
  console.log(`   ${r.name}: the pool is ${g(r.seed)} + ${g(r.price)} a ticket, and a ticket costs ${g(r.cost1)} bought on its own`);
  console.log(row(['tickets', 'pool', 'a ticket wins', 'its value', 'players get back', 'House edge', "House's result"], w2));
  for (const n of NS) {
    const pool = r.seed + n * r.price, paid = n * r.cost1, house = n * r.feeOf(1) - r.seed;
    console.log(row([fmt(n), fmt(pool), g(pool / n), sfmt(pool / n - r.cost1, 2), pc(pool / paid), spc(house / paid), sfmt(house)], w2));
  }
}
const under = (r) => (r.even === Infinity ? `any number of ${r.name} tickets` : `fewer than ${fmt(r.even)} ${r.name} tickets`);
if (RAFFLES.some((r) => r.even > 0)) {
  console.log(`   With ${RAFFLES.filter((r) => r.even > 0).map(under).join(' or ')} in a draw, players are ahead on average and the House`);
  console.log('   pays the difference out of its own gold.');
}
console.log(FEE_BP ? `   The most the House can keep is the fee's share of what players pay, ${pc(FEE_BP / (10000 + FEE_BP))}, and only in huge draws.` : '   With no fee the House never keeps anything.');

// ---------- 3. thin draws ----------
console.log('\n3. Thin draws: the seed is there for the taking');
for (const r of RAFFLES) {
  const alone = (q) => `${q} ticket${q > 1 ? 's' : ''} for ${g(q * r.price + r.feeOf(q))} win${q > 1 ? '' : 's'} ${g(r.seed + q * r.price)} (${sfmt(r.seed - r.feeOf(q))})`;
  console.log(`   alone in a ${r.name.padEnd(5)} draw: ${alone(1)}; ${alone(10)}`);
}
for (const r of RAFFLES.filter((x) => !x.seed)) console.log(`   With no seed there is nothing to take in a ${r.name} draw: even alone, a buyer only gets their own ticket prices back.`);
console.log('   The menu shows each pool, so anyone can count the tickets in a draw: (pool - seed) ÷ price.');
const BIG = 10, OTHERS = [0, 1, 3, 5, 10, 20, 30, 50, 90];
console.log(`   One buyer with ${BIG} tickets against single tickets bought by others (expected profit a draw):`);
const w3 = [12, 9, 13, 18, 10, 23, 10];
console.log(row(['others', 'tickets', 'big wins', 'big buyer: Mini', 'Grand', 'a single ticket: Mini', 'Grand'], w3));
const bigEv = (r, m) => (BIG / (BIG + m)) * (r.seed + (BIG + m) * r.price) - (BIG * r.price + r.feeOf(BIG));
const smallEv = (r, m) => (r.seed + (BIG + m) * r.price) / (BIG + m) - r.cost1;
for (const m of OTHERS) {
  const [mini, grand] = RAFFLES;
  console.log(row([m, BIG + m, pc(BIG / (BIG + m)), sfmt(bigEv(mini, m), 1), sfmt(bigEv(grand, m), 1), m ? sfmt(smallEv(mini, m), 2) : '-', m ? sfmt(smallEv(grand, m), 2) : '-'], w3));
}
// against m other tickets, b tickets earn b × seed ÷ (b + m) - their fees; the best is about (√seed - √(fee a ticket × m))²
const best = (r, m) => { let top = { b: 0, ev: 0 }; for (let b = 1; b <= 5000; b++) { const ev = (b * r.seed) / (b + m) - r.fees(b, 10); if (ev > top.ev) top = { b, ev }; } return top; };
console.log('   The best number to buy for someone who sees m other tickets in a draw, and what it makes on average:');
const w3b = [12, 18, 18];
console.log(row(['m', 'Mini', 'Grand'], w3b));
for (const m of [0, 3, 10, 30, 60, 90]) console.log(row([m, ...RAFFLES.map((r) => { if (!r.feeOf(1)) return m ? 'more is better' : `1 for ${sfmt(r.seed, 1)}`; const t = best(r, m); return t.b ? `${t.b} for ${sfmt(t.ev, 1)}` : 'none'; })], w3b));
{
  const r = RAFFLES.reduce((a, b) => (b.seed > a.seed ? b : a)), m = 3, n = BIG + m, rand = random(RNG * 7919 + 3), N = 1_000_000;
  let won = 0, profit = 0;
  for (let i = 0; i < N; i++) { const w = rand() * n < BIG; won += w; profit += (w ? r.seed + n * r.price : 0) - (BIG * r.price + r.feeOf(BIG)); }
  console.log(`   simulated ${fmt(N)} ${r.name} draws of ${BIG} tickets against ${m}: the big buyer won ${pc(won / N, 2)} and made ${sfmt(profit / N, 2)} a draw`);
  console.log(`   (exact: ${pc(BIG / n, 2)} and ${sfmt(bigEv(r, m), 2)})`);
}

// ---------- 4. a year of draws ----------
console.log("\n4. A year: the House's result is set by how many tickets sell");
console.log(`   ${fmt(DRAWS)} draws of each raffle (${g(PER_WEEK)} a week for ${WEEKS} weeks), both selling the same average, ${PACK} tickets a purchase.`);
console.log(`   The House starts each year with ${fmt(BANKROLL)} gold of its own; ${fmt(YEARS)} simulated years a line. The expected results (by`);
console.log('   raffle and together) and the spread (one standard deviation) are exact; the rest is simulated.');
const results = (p) => RAFFLES.map((r) => Float64Array.from(p, (_, n) => (n ? r.fees(n) - r.seed : 0)));
const MODELS = [['steady demand (Poisson)', Infinity], [`lumpy demand (negative binomial, k = ${K}: a draw's tickets vary by about ${pc(1 / Math.sqrt(K), 0)} of the average, more in small draws)`, K]];
let line = 0;
for (const [label, k] of MODELS) {
  console.log(`   ${label}`);
  const w = [16, ...RAFFLES.map(() => 10), 11, 8, 25, 9, 15, 13], means = [];
  console.log(row(['tickets a draw', ...RAFFLES.map((r) => r.name), 'together', 'spread', '90% of years between', 'behind', 'bankroll gone', 'median week'], w));
  for (const mu of DEMAND) {
    const p = demand(mu, k), draw = sampler(p), rand = random(RNG * 7919 + 100 + line++), res = results(p);
    const each = res.map((x) => DRAWS * expect(p, (n) => x[n])), mean = each.reduce((t, v) => t + v, 0);
    const sd = Math.sqrt(DRAWS * res.reduce((t, x) => { const m = expect(p, (n) => x[n]); return t + expect(p, (n) => (x[n] - m) ** 2); }, 0));
    const years = new Float64Array(YEARS), weeks = [];
    for (let y = 0; y < YEARS; y++) {
      let gold = BANKROLL, broke = -1;
      for (let t = 0; t < DRAWS; t++) {
        for (const x of res) gold += x[draw(rand())];
        if (gold < 0 && broke < 0) broke = t;
      }
      years[y] = gold - BANKROLL;
      if (broke >= 0) weeks.push(Math.floor(broke / PER_WEEK) + 1);
    }
    years.sort(); weeks.sort((a, b) => a - b);
    means.push(sfmt(years.reduce((s, v) => s + v, 0) / YEARS));
    const behind = years.filter((v) => v < 0).length / YEARS;
    console.log(row([fmt(mu), ...each.map((v) => sfmt(v)), sfmt(mean), fmt(sd), `${sfmt(years[Math.floor(0.05 * YEARS)])} and ${sfmt(years[Math.floor(0.95 * YEARS)])}`, odds(behind), odds(weeks.length / YEARS), weeks.length ? weeks[weeks.length >> 1] : '-'], w));
  }
  console.log(`     (the simulated years average ${means.join(', ')})`);
}
console.log("   Apart from this the House holds the players' gold: every balance, every pending withdrawal and the ticket gold in");
console.log('   both pools. That is owed whatever happens, so keep at least that much in the game on top of the bankroll.');

// ---------- 5. gold in and out ----------
console.log('\n5. Gold in and out');
console.log(`   A deposit: the player buys Raw Copper from the House at ${DEPOSIT} and is credited 1 gold a unit. The House gets the price`);
console.log(`   less its export tax, and hands over one Raw Copper (worth about ${COPPER} gold) for every gold it credits.`);
const w5 = [13, 15, 17, 13, 15, 28, 12];
console.log(row(['export tax', 'margin a gold', 'with the copper', 'break-even', 'margin there', 'copper too: 1 gold a unit', '10 a unit'], w5));
for (const t of [...new Set([0, 0.05, 0.1, 0.15, 0.2, EXPORT])].sort((a, b) => a - b)) {
  const even = up100(1 / (1 - t)), margin = DEPOSIT * (1 - t) - 1;
  console.log(row([pctOf(t), sfmt(margin, 4), sfmt(margin - COPPER, 4), fmt(even, 2), sfmt(even * (1 - t) - 1, 4), fmt(up100((1 + COPPER) / (1 - t)), 2), fmt(up100((10 + COPPER) / (1 - t)), 2)], w5));
}
console.log(`   (margin at today's ${DEPOSIT}; break-even = 1 ÷ (1 - export tax) rounded up to the hundredth; the last two columns are`);
console.log('   the prices that pay for the copper as well, with one Raw Copper for 1 gold of credit or for 10)');
console.log("   A withdrawal of X: the player lists Raw Copper for X and the House buys it, paying X plus its import tax: that is");
console.log(`   ${g(100 * IMPORT)} extra on every 100 withdrawn today. The fix: the player lists at X ÷ (1 + import tax), rounded down to the`);
console.log('   hundredth, and the House pays at most X:');
const imports = [...new Set([0.05, 0.1, IMPORT])].sort((a, b) => a - b), w5b = [12, ...imports.flatMap(() => [20, 13])];
console.log(row(['withdraw', ...imports.flatMap((t) => [`at ${pctOf(t)}: list at`, 'House pays'])], w5b));
for (const x of [100, 1000, 5000]) console.log(row([fmt(x), ...imports.flatMap((t) => { const l = down100(x / (1 + t)); return [fmt(l, 2), fmt(l * (1 + t), 2)]; })], w5b));
console.log(`   A round trip: 100 gold deposited at ${DEPOSIT} and withdrawn at once, without playing`);
const w5c = [16, 13, 10, 10, 23, 26];
console.log(row(["House's taxes", 'House gets', 'pays', 'result', `and 99 copper (${COPPER})`, 'a player taxed the same'], w5c));
const pairs = [...new Map([[0.05, 0.05], [0.1, 0.1], [EXPORT, IMPORT]].map((x) => [x.join(), x])).values()];
for (const [te, ti] of pairs) {
  const gets = 100 * DEPOSIT * (1 - te), pays = 100 * (1 + ti), player = -100 * DEPOSIT * (1 + ti) + 100 * (1 - te) + 99 * COPPER;
  console.log(row([`${pctOf(te)} / ${pctOf(ti)}`, fmt(gets, 2), fmt(pays, 2), sfmt(gets - pays, 2), sfmt(-99 * COPPER, 2), sfmt(player, 2)], w5c));
}
console.log('   With deposits at the break-even price and withdrawals listed at X ÷ (1 + import tax), the same round trip leaves');
console.log(`   the House ${pairs.map(([te, ti]) => `${sfmt(100 * up100(1 / (1 - te)) * (1 - te) - down100(100 / (1 + ti)) * (1 + ti), 2)} at ${pctOf(te)} / ${pctOf(ti)}`).join(', ')}, before the copper. The player's own taxes make it a loss`);
console.log("   for them too, so it isn't a way to farm gold; it's a leak the House pays on every deposit and every withdrawal.");

// ---------- 6. other ways to run it ----------
/** One raffle run draw by draw under a set of rules: what the House gains and what won pools took in and paid out. */
function runner(r, feeTable, { share = null, min = 1, cover = false, R = 0, caps = {} }) {
  const cap = caps[r.name] ?? r.seed;                                         // the most a seed paid from fees may reach
  let seed = r.seed, n = 0, f = 0;
  const s = { house: 0, paidIn: 0, paidOut: 0, draws: 0 };
  s.step = (sold, rand) => {
    if (R) sold = Math.min(sold, R);                                          // R numbers: sales stop at R
    if (sold) { n += sold; f += feeTable[sold]; s.house += feeTable[sold]; }
    if (!n) return;
    if (R ? !(sold && rand() * R < sold) : n < min || (cover && f < seed)) return;   // no winner yet: the pool waits
    s.house -= seed; s.paidOut += seed + n * r.price; s.paidIn += n * r.price + f; s.draws++;
    if (share !== null) seed = Math.min(cap, Math.floor(f * share));
    n = 0; f = 0;
  };
  return s;
}
const RULES = [
  ['today', {}],
  [`(a) ${fmt(SHARE * 100)}%`, { share: SHARE }],
  ...MINS.map((m) => [`(b) ${m}`, { min: m }]),
  ...RS.map((R) => [`(c) ${R}`, { R }]),
  ['recommended', { share: SHARE, cover: true }],
  ['+ Mini seed', { share: SHARE, cover: true, caps: { Mini: MINI_CAP } }],
];
console.log(`\n6. Other ways to run it (lumpy demand, k = ${K}; both raffles over a year)`);
console.log(`   (a) the next seed is ${fmt(SHARE * 100)}% of the fees the last draw took, at most today's seed`);
console.log('   (b) a draw goes ahead only with at least this many tickets; until then it waits for the next draw time and the pool grows');
console.log('   (c) a rollover: the winning number is drawn from 1 to R (sales stop at R); when no ticket holds it the pool rolls over');
console.log('   recommended: (a), and a draw goes ahead only once its fees cover its seed');
console.log(`   + Mini seed: the recommended rules, with the Mini also seeded from its fees (${fmt(SHARE * 100)}% of them, at most ${fmt(MINI_CAP)})`);
const tables = { house: [], back: [], draws: [] }, dev = [];
for (const mu of DEMAND) {
  const p = demand(mu, K), draw = sampler(p), rand = random(RNG * 7919 + 200 + DEMAND.indexOf(mu));
  const fees = RAFFLES.map((r) => Float64Array.from(p, (_, n) => r.fees(n)));
  const runs = RULES.map(([, rules]) => RAFFLES.map((r, i) => runner(r, fees[i], rules)));
  for (let t = 0; t < YEARS * DRAWS; t++) for (let i = 0; i < RAFFLES.length; i++) { const sold = draw(rand()); for (const run of runs) run[i].step(sold, rand); }
  const sim = runs.map((run) => ({ house: run.reduce((t, s) => t + s.house, 0) / YEARS, back: run.map((s) => s.paidOut / s.paidIn), draws: run.map((s) => s.draws / YEARS) }));
  // exact for today, (a) and (c), raffle by raffle: fees in and seeds out, a draw time at a time
  const per = (i, f) => DRAWS * expect(p, (n) => f(RAFFLES[i], n, fees[i]));
  const exact = RULES.map(([, { share, min = 1, cover, R }]) => {
    if (cover || min > 1) return null;
    const each = RAFFLES.map((_, i) => {
      if (R) {
        const m = (n) => Math.min(n, R);
        return { house: per(i, (r, n, x) => x[m(n)] - (r.seed * m(n)) / R), back: per(i, (r, n) => m(n) * r.price + (r.seed * m(n)) / R) / per(i, (r, n, x) => m(n) * r.price + x[m(n)]), draws: (DRAWS * expect(p, m)) / R };
      }
      const seedPaid = (r, n, x) => (share === undefined ? (n ? r.seed : 0) : Math.min(r.seed, Math.floor(x[n] * share)));
      return { house: per(i, (r, n, x) => x[n] - seedPaid(r, n, x)), back: per(i, (r, n, x) => n * r.price + seedPaid(r, n, x)) / per(i, (r, n, x) => n * r.price + x[n]), draws: DRAWS * (1 - p[0]) };
    });
    return { house: each.reduce((t, e) => t + e.house, 0), back: each.map((e) => e.back), draws: each.map((e) => e.draws) };
  });
  const yearFees = RAFFLES.reduce((t, _, i) => t + per(i, (r, n, x) => x[n]), 0);
  exact.forEach((e, j) => e && yearFees && dev.push(Math.abs(sim[j].house - e.house) / yearFees));
  const pick = (j) => exact[j] ?? sim[j];
  tables.house.push([fmt(mu), ...RULES.map((_, j) => sfmt(pick(j).house))]);
  RAFFLES.forEach((r, i) => {
    tables.back.push([`${fmt(mu)} ${r.name}`, ...RULES.map((_, j) => pc(pick(j).back[i]))]);
    tables.draws.push([`${fmt(mu)} ${r.name}`, ...RULES.map((_, j) => fmt(pick(j).draws[i], 1))]);
  });
}
const w6 = [17, ...RULES.map(([name]) => Math.max(10, name.length + 3))], head6 = ['tickets a draw', ...RULES.map(([name]) => name)];
for (const [k, title] of [['house', "the House's result a year, both raffles"], ['back', 'players get back, of what they paid into won pools'], ['draws', 'draws a year (for (c), winners)']]) {
  console.log(`   ${title}`);
  console.log(row(head6, w6));
  for (const cells of tables[k]) console.log(row(cells, w6));
}
console.log(`   (b), recommended and + Mini seed are simulated (${fmt(YEARS)} years a line); the other columns are exact, and the same simulation`);
console.log(`   reproduces them to within ${dev.length ? pc(Math.max(...dev), 2) : '-'} of a year's fees.`);
{
  const rules = RULES.find(([name]) => name === 'recommended')[1], years = Math.max(100, Math.round(YEARS / 4)), out = [];
  for (const mu of DEMAND) {
    const p = demand(mu, Infinity), draw = sampler(p), rand = random(RNG * 7919 + 300 + DEMAND.indexOf(mu));
    const run = RAFFLES.map((r) => runner(r, Float64Array.from(p, (_, n) => r.fees(n)), rules));
    for (let t = 0; t < years * DRAWS; t++) for (const s of run) s.step(draw(rand()), rand);
    out.push(run.map((s) => s.draws / years));
  }
  for (const [i, r] of RAFFLES.entries()) if (r.seed) console.log(`   With steady (Poisson) demand the recommended rules skip far fewer ${r.name} draws: ${out.map((d) => fmt(d[i], 1)).join(', ')} a year at ${DEMAND.map((x) => fmt(x)).join(', ')} tickets.`);
}
console.log(`   (c) a won pool holds the seed plus R tickets on average, whatever the demand: ${RS.map((R) => `R ${R}: ${RAFFLES.map((r) => `${r.name} ${fmt(r.seed + R * r.price)}`).join(', ')}`).join('; ')}.`);
const seeded = RAFFLES.filter((r) => r.seed > 3 * r.feeOf(1));
if (seeded.length) {
  console.log("   A minimum of different players alone doesn't help the House: three players with one ticket each still share");
  console.log(`   ${seeded.map((r) => `the ${r.name}'s ${g(r.seed)}-gold seed for ${g(3 * r.feeOf(1))} gold of fees`).join(', or ')}.`);
}
console.log("   Under the recommended rules a draw's fees always cover its seed and seeds come only from fees: no draw costs the House");
console.log(`   gold, no buyer can expect a profit, and the House keeps at least ${fmt((1 - SHARE) * 100)}% of the fees.`);

// ---------- 7. the recommended settings, in numbers ----------
console.log('\n7. The recommended settings, in numbers (the reasons are in docs/profitability.md)');
for (const r of RAFFLES) {
  const next = Math.min(r.seed, Math.floor(r.fees(30, 1) * SHARE)), needs = r.feeOf(1) ? fmt(Math.ceil(next / r.feeOf(1))) : '-';
  if (r.seed) {
    console.log(`   ${r.name}: the seed is ${fmt(SHARE * 100)}% of the fees the last draw took, at most ${g(r.seed)}. At its announced time a draw goes ahead`);
    console.log(`     only if its fees cover its seed; otherwise it is announced for the next slot. After a 30-ticket draw the next pool`);
    console.log(`     starts at ${fmt(next)} and needs ${needs} tickets.`);
  } else {
    console.log(`   ${r.name}: no seed, as now; every draw keeps its fees and can't cost the House anything.`);
    if (r.name === 'Mini' && MINI_CAP) console.log(`     If a starting pool would help it sell, seed it from its own fees too, at most ${fmt(MINI_CAP)}: the "+ Mini seed" column.`);
  }
}
console.log(`   fee: ${pc(FEE_BP / 10000, FEE_BP % 100 ? 2 : 0)}, rounded up per purchase`);
for (const t of [...new Set([0.05, 0.1, EXPORT])].sort((a, b) => a - b)) {
  console.log(`   deposits at a ${pctOf(t)} export tax: ${fmt(up100(1 / (1 - t)), 2)} a gold covers the tax; with the copper, ${fmt(up100((1 + COPPER) / (1 - t)), 2)} a gold, or one Raw Copper for 10 gold at ${fmt(up100((10 + COPPER) / (1 - t)), 2)}`);
}
const divisor = (t) => fmt(1 + t, Math.max(2, String(Math.round((1 + t) * 1e4) / 1e4).split('.')[1]?.length ?? 0));
for (const t of imports) console.log(`   withdrawals at a ${pctOf(t)} import tax: list one Raw Copper at X ÷ ${divisor(t)}, rounded down to the hundredth (100 → ${fmt(down100(100 / (1 + t)), 2)})`);
