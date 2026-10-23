// Which Supabase project the page talks to. The live project's URL and publishable key are public by design (they ship
// in every visitor's browser); row-level security and the database functions are what protect the gold.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jbpqrjfpbhautjcgxxjj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_3uJ_1ClpMHe0jFud4lEZ8Q_HXJNmsPy';
