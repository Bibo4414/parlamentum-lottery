// A stand-in for parlamentum.org's JSON API, for testing the watcher. Never used against the real game.
// Serves the four GETs the watcher makes from fixtures the test sets, counts hits, and remembers the login it was sent.
import http from 'node:http';

export interface Fixtures {
  me: unknown;
  ledger: unknown;
  contracts: unknown;
  listings: unknown;
  /** answer every request with this status (401 = login run out, 429 = refused) */
  status?: number;
  /** answer with a web page instead of JSON */
  html?: boolean;
}

const ROUTES: Record<string, keyof Fixtures> = {
  '/api/me': 'me',
  '/api/trade/ledger': 'ledger',
  '/api/contracts': 'contracts',
  '/api/global-market/mine': 'listings',
};

export function mockGame(port: number) {
  let fixtures: Fixtures = { me: { id: 'house-1', name: 'Bibo4414' }, ledger: { rows: [] }, contracts: [], listings: [] };
  let hits: Record<string, number> = {};
  let lastLogin = '';
  const server = http.createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    hits[path] = (hits[path] ?? 0) + 1;
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ') || auth.length < 12) return void res.writeHead(401).end();
    lastLogin = auth.slice(7);
    if (fixtures.status) return void res.writeHead(fixtures.status).end();
    if (fixtures.html) return void res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Just a moment…</title>');
    const key = ROUTES[path];
    if (!key) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(fixtures[key]));
  });
  return {
    start: () => new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    set: (next: Partial<Fixtures>) => { fixtures = { ...fixtures, status: undefined, html: undefined, ...next } as Fixtures; },
    hits: () => ({ ...hits }),
    resetHits: () => { hits = {}; },
    lastLogin: () => lastLogin,
  };
}

let n = 0;
/** A sale on the House's trade ledger, shaped like the game's (gold in hundredths, numbers as strings). */
export function sale(buyer: string | null, units: number, priceCents: number, taxPct: number, more: Record<string, unknown> = {}) {
  const total = units * priceCents;
  return {
    id: `t${Date.now().toString(36)}${(n++).toString(36)}`, at: new Date().toISOString(), book: 'GLOBAL', side: 'SOLD', itemType: 'COPPER_RAW', tier: null,
    currency: 'GOLD', counterparty: buyer, quantity: String(units), pricePerUnit: String(priceCents), total: String(total),
    taxPaid: String(Math.max(1, Math.floor((total * taxPct) / 100))), ...more,
  };
}

/** An accepted contract that sends the House gold for the deposit item. */
export function contract(sender: string, goldCents: number, more: Record<string, unknown> = {}) {
  return {
    id: `c${Date.now().toString(36)}${(n++).toString(36)}`, status: 'ACCEPTED', respondedAt: new Date().toISOString(),
    proposer: { id: `p-${sender}`, name: sender }, receiver: { id: 'house-1' },
    lines: [{ side: 'PROPOSER', asset: 'GOLD', amount: String(goldCents) }, { side: 'RECEIVER', asset: 'ITEM', amount: '1', itemType: 'COPPER_RAW' }],
    ...more,
  };
}

/** A login shaped like the game's (a JSON web token) that runs out in `days`. Only the mock ever sees it. */
export function fakeLogin(days = 7) {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'house-1', exp: Math.floor(Date.now() / 1000) + days * 86_400 })}.${'x'.repeat(43)}`;
}
