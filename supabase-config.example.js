/**
 * Copy to supabase-config.js and fill in your project values,
 * or leave defaults and set window globals before loading waitlist-supabase.js:
 *
 *   <script>
 *     window.__SHELFYST_SUPABASE_URL__ = 'https://YOUR_PROJECT.supabase.co';
 *     window.__SHELFYST_SUPABASE_ANON_KEY__ = 'YOUR_ANON_OR_PUBLISHABLE_KEY';
 *   </script>
 */

const win = typeof window !== 'undefined' ? window : {};

export const SUPABASE_URL =
  win.__SHELFYST_SUPABASE_URL__ || 'https://YOUR_PROJECT.supabase.co';

export const SUPABASE_ANON_KEY =
  win.__SHELFYST_SUPABASE_ANON_KEY__ || 'YOUR_ANON_OR_PUBLISHABLE_KEY';
