// Checks a finished draw the way anyone can, from what the lottery publishes:
// 1. the seed revealed after the draw has the SHA-256 shown while tickets were on sale (so it wasn't swapped),
// 2. the published ticket list is the one the draw used,
// 3. seed and list point at the winning ticket: the first 52 bits of SHA-256("seed:draw:list digest"), modulo the
//    number of tickets, is the winner's place in the list ordered by ticket number.
// The same steps work with any SHA-256 tool, e.g. `printf %s "<seed>" | shasum -a 256`.

export interface DrawRecord {
  id: number;
  seed_hash: string | null;
  seed: string | null;
  tickets_digest: string | null;
  ticket_count: number | null;
  winning_index: number | null;
  winning_ticket: number | null;
}
export interface Entry { ticket_number: number; username: string }
export interface Check { label: string; ok: boolean }
export interface Verdict { ok: boolean; checks: Check[]; ticket: number | null; winner: string | null }

export async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The list exactly as the database hashed it: "number:username", one a line, by ticket number. */
export const ticketList = (entries: Entry[]) =>
  [...entries].sort((a, b) => a.ticket_number - b.ticket_number).map((e) => `${e.ticket_number}:${e.username}`).join('\n');

/** The winner's place in the list: 52 bits fit a JavaScript number exactly. */
export async function winningIndex(seed: string, drawId: number, digest: string, count: number): Promise<number> {
  const h = await sha256(`${seed}:${drawId}:${digest}`);
  return parseInt(h.slice(0, 13), 16) % count;
}

export async function verifyDraw(draw: DrawRecord, entries: Entry[]): Promise<Verdict> {
  if (!draw.seed || !draw.seed_hash || !draw.tickets_digest || !entries.length) {
    return { ok: false, checks: [{ label: 'This draw has no published seed to check.', ok: false }], ticket: null, winner: null };
  }
  const sorted = [...entries].sort((a, b) => a.ticket_number - b.ticket_number);
  const digest = await sha256(ticketList(sorted));
  const index = await winningIndex(draw.seed, draw.id, digest, sorted.length);
  const picked = sorted[index] ?? null;
  const checks: Check[] = [
    { label: 'The seed matches the fingerprint shown before the draw', ok: (await sha256(draw.seed)) === draw.seed_hash },
    { label: `The ${sorted.length} tickets are the ones the draw used`, ok: digest === draw.tickets_digest && sorted.length === draw.ticket_count },
    { label: `Seed and tickets pick ticket #${picked?.ticket_number ?? '?'}`, ok: index === draw.winning_index && picked?.ticket_number === draw.winning_ticket },
  ];
  return { ok: checks.every((c) => c.ok), checks, ticket: picked?.ticket_number ?? null, winner: picked?.username ?? null };
}
