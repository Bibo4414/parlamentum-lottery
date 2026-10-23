// The watcher's pure parts, without the game or the database.
import { describe, expect, it } from 'vitest';
import { Off, cleanToken, creditFor, depositContracts, depositListing, fallbackTax, loginEnds, marketBuys, sameSecret, seal, unseal, type Terms } from '../supabase/functions/watcher/core.ts';
import { contract, fakeLogin, sale } from './mock-game.ts';

const terms: Terms = { item: 'COPPER_RAW', tier: null, priceCents: 112, exportTaxPct: 10 };

describe('what a trade credits', () => {
  it('is what the House received after the tax, in whole gold, rounded down', () => {
    expect(creditFor(11200, 1120)).toBe(100);
    expect(creditFor(10500, 1050)).toBe(94);
    expect(creditFor(112, 113)).toBe(0);
  });

  it('uses the ledger’s own tax when it has one, and the game’s rule otherwise', () => {
    const [withTax] = marketBuys({ rows: [sale('Aurelia', 10, 112, 10, { taxPaid: '100' })] }, terms);
    expect(withTax).toMatchObject({ gross_cents: 1120, tax_cents: 100, gold: 10 });
    const [without] = marketBuys({ rows: [sale('Aurelia', 10, 112, 10, { total: undefined, taxPaid: undefined })] }, terms);
    expect(without).toMatchObject({ gross_cents: 1120, tax_cents: 112, gold: 10 });
    expect(fallbackTax(5, 10)).toBe(1); // at least a hundredth
    expect(fallbackTax(1000, 0)).toBe(0);
  });
});

describe('reading the ledger', () => {
  it('keeps only global-market sales of the deposit item, at the deposit price, in gold, to someone', () => {
    const rows = [
      sale('Keep', 1, 112, 10), sale('Price', 1, 111, 10), sale('Item', 1, 112, 10, { itemType: 'IRON_RAW' }),
      sale('Side', 1, 112, 10, { side: 'BOUGHT' }), sale('Book', 1, 112, 10, { book: 'LOCAL' }),
      sale('Coin', 1, 112, 10, { currency: 'SILVER' }), sale(null, 1, 112, 10), sale('   ', 1, 112, 10),
    ];
    expect(marketBuys({ rows }, terms).map((s) => s.name)).toEqual(['Keep']);
  });

  it('can be held to one tier of the item', () => {
    const rows = [sale('T1', 1, 112, 10, { tier: 'T1' }), sale('T2', 1, 112, 10, { tier: 'T2' })];
    expect(marketBuys({ rows }, { ...terms, tier: 'T1' }).map((s) => s.name)).toEqual(['T1']);
    expect(marketBuys({ rows }, terms)).toHaveLength(2);
  });

  it('stops at an answer in a shape it doesn’t know, rather than guessing', () => {
    expect(() => marketBuys({ rows: [{ id: 7 }] }, terms)).toThrow(Off);
    expect(() => marketBuys({ trades: [] }, terms)).toThrow(Off);
    expect(() => marketBuys({ rows: [sale('X', 1, 112, 10, { quantity: '1.5' })] }, terms)).toThrow(Off);
    expect(() => depositContracts({}, 'house-1', terms)).toThrow(Off);
    expect(() => depositListing([{ itemType: 'COPPER_RAW' }], terms)).toThrow(Off);
  });

  it('cleans up the buyer’s name the way names are compared', () => {
    expect(marketBuys({ rows: [sale('  Livia Drusa ', 1, 112, 10)] }, terms)[0]!.name).toBe('Livia Drusa');
  });
});

describe('reading contracts and listings', () => {
  it('counts gold-for-copper contracts the House accepted, and nothing else', () => {
    const kept = depositContracts([
      contract('Keep', 10000),
      contract('Pending', 10000, { status: 'PENDING' }),
      contract('Elsewhere', 10000, { receiver: { id: 'other' } }),
      contract('Mixed', 10000, { lines: [{ side: 'PROPOSER', asset: 'GOLD', amount: '100' }, { side: 'PROPOSER', asset: 'ITEM', amount: '1', itemType: 'IRON_RAW' }, { side: 'RECEIVER', asset: 'ITEM', amount: '1', itemType: 'COPPER_RAW' }] }),
      contract('NoCopper', 10000, { lines: [{ side: 'PROPOSER', asset: 'GOLD', amount: '100' }] }),
    ], 'house-1', terms);
    expect(kept.map((c) => [c.name, c.gold, c.tax_cents])).toEqual([['Keep', 100, 0]]);
  });

  it('finds the fullest live deposit listing', () => {
    const later = new Date(Date.now() + 86_400_000).toISOString();
    const listing = (remaining: string, more: Record<string, unknown> = {}) => ({ itemType: 'COPPER_RAW', tier: null, pricePerUnit: '112', remaining, expiresAt: later, ...more });
    expect(depositListing([listing('40'), listing('900'), listing('5000', { pricePerUnit: '100' }), listing('9999', { cancelledAt: later }),
      listing('9999', { expiresAt: new Date(Date.now() - 1000).toISOString() })], terms)).toEqual({ remaining: 900, endsAt: later });
    expect(depositListing([], terms)).toBeNull();
  });
});

describe('the login', () => {
  const key = 'k'.repeat(40);

  it('seals and opens again with the same key, and only with it', async () => {
    const token = fakeLogin();
    const sealed = await seal(token, key);
    expect(sealed).not.toContain(token.split('.')[1]!);
    expect(await unseal(sealed, key)).toBe(token);
    expect(await unseal(sealed, 'x'.repeat(40))).toBeNull();
    expect(await seal(token, key)).not.toBe(sealed); // a fresh nonce every time
  });

  it('notices a sealed login that was tampered with', async () => {
    const sealed = await seal(fakeLogin(), key);
    const [iv, body] = sealed.split('.') as [string, string];
    const flipped = body.slice(0, 10) + (body[10] === 'A' ? 'B' : 'A') + body.slice(11);
    expect(await unseal(`${iv}.${flipped}`, key)).toBeNull();
    expect(await unseal('garbage', key)).toBeNull();
  });

  it('refuses a short sealing key', async () => {
    await expect(seal('x', 'too-short')).rejects.toThrow(/32 characters/);
  });

  it('reads when a login runs out, and recognises what isn’t one', () => {
    const ends = loginEnds(fakeLogin(7));
    expect(Math.abs(ends!.getTime() - (Date.now() + 7 * 86_400_000))).toBeLessThan(5000);
    expect(loginEnds('not-a-token')).toBeNull();
    expect(loginEnds('a.b.c')).toBeNull();
    expect(loginEnds('x'.repeat(5000))).toBeNull();
    expect(cleanToken(' "abc.def.ghi" ')).toBe('abc.def.ghi');
    expect(cleanToken(42)).toBe('');
  });

  it('compares the schedule’s secret in full', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('abc', 'abcd')).toBe(false);
    expect(sameSecret('', 'abc')).toBe(false);
  });
});
