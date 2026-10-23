// Which Supabase project the page talks to: the live one, or another (e.g. the local stack) through
// VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
import { LIVE_SUPABASE_PUBLISHABLE_KEY, LIVE_SUPABASE_URL } from './project.ts';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || LIVE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || LIVE_SUPABASE_PUBLISHABLE_KEY;
