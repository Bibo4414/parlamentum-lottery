// Icons from Lucide (ISC licence), drawn inline in one stroke weight. Only the ones the page uses are imported.
import {
  ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Ban, Check, ChevronDown, CircleCheck, CircleX, Clock, Coins, Copy, History, Hourglass,
  Landmark, LockKeyhole, LogOut, Minus, Plus, RefreshCw, SatelliteDish, Settings, ShieldCheck, Stamp, Ticket, TriangleAlert,
  Trophy, User, Wallet, X, type IconNode,
} from 'lucide';

const icons = {
  'arrow-down': ArrowDownToLine, 'arrow-left': ArrowLeft, 'arrow-up': ArrowUpFromLine, ban: Ban, check: Check, 'chevron-down': ChevronDown, 'circle-check': CircleCheck,
  'circle-x': CircleX, clock: Clock, coins: Coins, copy: Copy, history: History, hourglass: Hourglass, landmark: Landmark, lock: LockKeyhole,
  'log-out': LogOut, minus: Minus, plus: Plus, refresh: RefreshCw, satellite: SatelliteDish, settings: Settings, seal: ShieldCheck,
  stamp: Stamp, ticket: Ticket, warning: TriangleAlert, trophy: Trophy, user: User, wallet: Wallet, x: X,
} satisfies Record<string, IconNode>;
export type IconName = keyof typeof icons;

const attr = (a: Record<string, string | number | undefined>) =>
  Object.entries(a).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}="${String(v)}"`).join(' ');

/** An inline SVG icon; decorative (aria-hidden) unless it is given a label. */
export function icon(name: IconName, label?: string): string {
  const body = icons[name].map(([tag, a]) => `<${tag} ${attr(a as Record<string, string | number | undefined>)}/>`).join('');
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}
