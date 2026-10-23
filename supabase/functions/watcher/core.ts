// The watcher's pure parts: reading the game's answers, sealing the House's login, and the gold a trade credits.
// Ported from The Back Room casino's watcher and the Grow Ur Gold exchange's port of it. Only Web APIs (fetch,
// crypto.subtle), so the same file runs in the edge function (Deno) and in the tests (Node).

/** Why the watcher can't look right now, in words for the organizer. Never carries the login. */
export class Off extends Error {}

function changed(what: string): never {
  throw new Off(`The game's ${what} came back in a shape the watcher doesn't know. The game may have changed; the watcher stopped crediting until it is updated.`);
}

export interface Terms { item: string; tier: string | null; priceCents: number; exportTaxPct: number }
/** A deposit seen in the game. Gold figures in hundredths, as the game counts; `gold` is the whole gold it credits. */
export interface Seen { id: string; kind: 'market' | 'contract'; at: string; units: number | null; gross_cents: number; tax_cents: number; gold: number; name: string }
export interface Listing { remaining: number; endsAt: string }

type Row = Record<string, unknown>;
const str = (v: unknown): v is string => typeof v === 'string';
const digits = (v: unknown): v is string => str(v) && /^\d{1,15}$/.test(v);
const when = (v: unknown): v is string => str(v) && !Number.isNaN(Date.parse(v));
const rec = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
export const cleanName = (raw: unknown) => String(raw ?? '').normalize('NFKC').trim();

/** What a purchase credits: the gold the House really received (the trade's total less the game's tax), rounded down. */
export const creditFor = (grossCents: number, taxCents: number) => Math.floor(Math.max(0, grossCents - taxCents) / 100);

/** The game's export tax on a sale when the ledger leaves it out: rounded down, and at least a hundredth. */
export const fallbackTax = (grossCents: number, exportTaxPct: number) =>
  exportTaxPct > 0 ? Math.max(1, Math.floor((grossCents * exportTaxPct) / 100)) : 0;

/** Buys of the deposit item from the trade ledger: sold on the global market, at the deposit price, to a named buyer. */
export function marketBuys(v: unknown, t: Terms): Seen[] {
  const rows = rec(v) ? v.rows : null;
  if (!Array.isArray(rows)) changed('trade ledger');
  const out: Seen[] = [];
  for (const r of rows as unknown[]) {
    if (!rec(r) || !str(r.id) || !when(r.at) || !str(r.book) || !str(r.side) || !str(r.itemType) || !(r.tier == null || str(r.tier))
      || !str(r.currency) || !(r.counterparty === null || str(r.counterparty)) || !digits(r.quantity) || !digits(r.pricePerUnit)) changed('trade ledger');
    const x = r as Row & { id: string; at: string; quantity: string; pricePerUnit: string; counterparty: string | null };
    if (x.book !== 'GLOBAL' || x.side !== 'SOLD' || x.itemType !== t.item || (t.tier !== null && x.tier !== t.tier) || x.currency !== 'GOLD'
      || Number(x.pricePerUnit) !== t.priceCents || !x.counterparty?.trim()) continue;
    const units = Number(x.quantity);
    // the ledger's own figures when it has them; otherwise the game's rule
    const gross = digits(x.total) ? Number(x.total) : units * t.priceCents;
    const tax = digits(x.taxPaid) ? Number(x.taxPaid) : fallbackTax(gross, t.exportTaxPct);
    out.push({ id: `trade:${x.id}`, kind: 'market', at: new Date(x.at).toISOString(), units, gross_cents: gross, tax_cents: tax, gold: creditFor(gross, tax), name: cleanName(x.counterparty) });
  }
  return out;
}

/** Accepted deposit contracts: sent to the House, gold from the sender and nothing else, the deposit item back. No tax. */
export function depositContracts(v: unknown, houseId: string, t: Terms): Seen[] {
  if (!Array.isArray(v)) changed('contract list');
  const out: Seen[] = [];
  for (const c of v as unknown[]) {
    if (!rec(c) || !str(c.id) || !str(c.status) || !(c.respondedAt === null || when(c.respondedAt)) || !rec(c.proposer) || !rec(c.receiver)
      || !str(c.proposer.id) || !str(c.proposer.name) || !str(c.receiver.id) || !Array.isArray(c.lines)) changed('contract list');
    const lines = c.lines as unknown[];
    if (lines.some((l) => !rec(l) || !str(l.side) || !str(l.asset) || !digits(l.amount))) changed('contract list');
    const ls = lines as { side: string; asset: string; amount: string; itemType?: unknown }[];
    if (c.status !== 'ACCEPTED' || !c.respondedAt || (c.receiver as Row).id !== houseId) continue;
    const given = ls.filter((l) => l.side === 'PROPOSER'), back = ls.filter((l) => l.side === 'RECEIVER');
    if (!given.length || given.some((l) => l.asset !== 'GOLD') || !back.length || back.some((l) => l.asset !== 'ITEM' || l.itemType !== t.item)) continue;
    const cents = given.reduce((sum, l) => sum + Number(l.amount), 0);
    out.push({ id: `contract:${c.id}`, kind: 'contract', at: new Date(c.respondedAt as string).toISOString(), units: null, gross_cents: cents, tax_cents: 0, gold: creditFor(cents, 0), name: cleanName((c.proposer as Row).name) });
  }
  return out;
}

/** The deposit listing: the House's live listing of the deposit item at the deposit price, the fullest one. */
export function depositListing(v: unknown, t: Terms, now = Date.now()): Listing | null {
  if (!Array.isArray(v)) changed('listing list');
  let best: Listing | null = null;
  for (const l of v as unknown[]) {
    if (!rec(l) || !str(l.itemType) || !digits(l.pricePerUnit) || !digits(l.remaining) || !when(l.expiresAt)) changed('listing list');
    const x = l as Row & { itemType: string; pricePerUnit: string; remaining: string; expiresAt: string };
    if (x.itemType !== t.item || (t.tier !== null && x.tier !== t.tier) || Number(x.pricePerUnit) !== t.priceCents || x.expired === true || x.cancelledAt || Date.parse(x.expiresAt) <= now) continue;
    if (!best || Number(x.remaining) > best.remaining) best = { remaining: Number(x.remaining), endsAt: new Date(x.expiresAt).toISOString() };
  }
  return best;
}

/** One GET of the House's side of the game, with the House's login. */
export async function game(base: string, path: string, token: string): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(base + path, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Off('The game didn’t answer.');
  }
  if (r.status === 401) throw new Off('The game login has run out or was revoked. Paste a fresh one.');
  if (r.status === 403 || r.status === 429) throw new Off(`The game refused the request (${r.status}). The watcher tries again on its next look.`);
  if (!r.ok) throw new Off(`The game answered with an error (${r.status}).`);
  if (!(r.headers.get('content-type') ?? '').includes('json')) throw new Off('The game answered with a web page instead of data.');
  try {
    return await r.json();
  } catch {
    throw new Off('The game’s answer couldn’t be read.');
  }
}

/** The House's id in the game, from its own profile. */
export function houseId(me: unknown): string {
  if (!rec(me) || !str(me.id)) changed('player profile');
  return (me as Row).id as string;
}

// ---------- the login, sealed ----------

const enc = new TextEncoder();
const b64url = (b: Uint8Array) => btoa(Array.from(b, (c) => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function sealKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('WATCHER_SEAL_KEY must be at least 32 characters.');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`${secret}:watcher`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** AES-256-GCM with a key derived from WATCHER_SEAL_KEY: "iv.ciphertext+tag", base64url. */
export async function seal(text: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(secret), enc.encode(text)));
  return `${b64url(iv)}.${b64url(body)}`;
}

/** The login back, or null if it can't be read (another key, or tampered with). */
export async function unseal(sealed: string, secret: string): Promise<string | null> {
  try {
    const [iv, body] = sealed.split('.');
    if (!iv || !body) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv) }, await sealKey(secret), fromB64url(body));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** When a game login (a JSON web token) runs out, read from the token itself; null if it is not one. */
export function loginEnds(token: string): Date | null {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 4_000 || !parts[1]) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    return typeof claims?.exp === 'number' ? new Date(claims.exp * 1000) : null;
  } catch {
    return null;
  }
}

/** A token as pasted from the browser console: with or without its quotes. */
export const cleanToken = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/^"|"$/g, '') : '');

/** CORS headers: the lottery page's origin is answered with itself; any other gets the first allowed origin, which
 *  its browser then refuses. (Locally the API gateway answers CORS itself; the hosted one passes these through.) */
export function corsFor(origin: string, allowed: string[]): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Compares secrets without leaking where they differ through timing. */
export function sameSecret(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
