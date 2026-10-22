// Just enough of Deno for tsc to check the edge functions on a machine without Deno (npm run typecheck).
declare namespace Deno {
  export const env: { get(name: string): string | undefined; toObject(): Record<string, string> };
  export function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
}
declare module 'npm:@supabase/supabase-js@2.117.2' {
  export * from '@supabase/supabase-js';
}
