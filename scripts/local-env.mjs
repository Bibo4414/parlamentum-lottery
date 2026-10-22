// Points `npm run dev` at the local Supabase stack: writes .env.development.local (gitignored) with its URL and key.
import { writeFileSync } from 'node:fs';
import { localStack } from './dev-seed.mjs';

const { url, publishable } = localStack();
writeFileSync('.env.development.local', `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${publishable}\n`);
console.log(`npm run dev now talks to ${url}. Delete .env.development.local to go back to the live project.`);
