// The one Supabase client the page uses.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config.ts';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
export type Rpc = keyof Database['public']['Functions'];
