import { defineConfig, loadEnv, type Plugin } from 'vite';
import { LIVE_SUPABASE_URL } from './src/project.ts';

/** The built page may run only its own scripts and talk only to its Supabase project. GitHub Pages can't send
 *  headers, so the policy rides in a meta tag; dev builds go without it so live reload keeps working. */
function contentSecurityPolicy(supabaseUrl: string): Plugin {
  const api = new URL(supabaseUrl).origin;
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${api} ${api.replace(/^http/, 'ws')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`),
  };
}

// GitHub Pages serves the site from /parlamentum-lottery/, so built asset paths stay relative.
export default defineConfig(({ mode }) => ({
  base: './',
  build: { target: 'es2022' },
  plugins: [contentSecurityPolicy(loadEnv(mode, process.cwd()).VITE_SUPABASE_URL || LIVE_SUPABASE_URL)],
}));
