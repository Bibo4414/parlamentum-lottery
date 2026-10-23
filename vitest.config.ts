import { defineConfig } from 'vitest/config';

// Integration tests: they run against the local Supabase stack (npm run db:start), never a hosted project.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
