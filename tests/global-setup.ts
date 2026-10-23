// Finds the local Supabase stack once and hands its address and keys to the tests. Refuses anything that isn't local.
import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

export interface Stack { url: string; publishable: string; secret: string; functions: string }
declare module 'vitest' {
  export interface ProvidedContext { stack: Stack }
}

export default function setup(project: TestProject) {
  let status: Record<string, string>;
  try {
    status = JSON.parse(execSync('npx -y supabase@2.119.0 status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch {
    throw new Error('The local Supabase stack is not running. Start it with `npm run db:start` (Docker must be running).');
  }
  const url = status.API_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw new Error(`Tests only run against a local stack, not ${url}`);
  project.provide('stack', { url, publishable: status.PUBLISHABLE_KEY ?? '', secret: status.SECRET_KEY ?? '', functions: status.FUNCTIONS_URL ?? '' });
}
