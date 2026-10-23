/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Another Supabase project to talk to, e.g. the local stack (npm run db:env writes .env.development.local). */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
