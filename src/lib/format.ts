// Numbers, gold, dates and plain-text escaping, written the same way everywhere.

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1767 → "1,767". */
export const fmt = (n: number | null | undefined) => whole.format(Number(n || 0));
/** Hundredths of gold → "1.12". */
export const goldOf = (hundredths: number) => cents.format(hundredths / 100);

/** Text for HTML: everything a player or the database wrote goes through this. */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const utcFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hourCycle: 'h23' });
const localFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hourCycle: 'h23' });

/** "Sat 25 Oct, 18:00 UTC": draw times are announced in UTC, as the game's day runs. */
export const utc = (iso: string) => `${utcFmt.format(new Date(iso)).replace(',', '')} UTC`;
/** The same moment on the player's own clock. */
export const local = (iso: string) => localFmt.format(new Date(iso));
/** "22 Oct, 23:56": for lists, in UTC. */
export const day = (iso: string) => dayFmt.format(new Date(iso)).replace(',', '');

/** Time left until `iso`: "2 d 4 h", "3 h 12 min", "4 min 05 s", or null once it has passed. */
export function countdown(iso: string, now = Date.now()): string | null {
  let s = Math.floor((Date.parse(iso) - now) / 1000);
  if (s <= 0) return null;
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

/** "3 tickets", "1 ticket". */
export const tickets = (n: number) => `${fmt(n)} ${n === 1 ? 'ticket' : 'tickets'}`;
