/**
 * Supabase public configuration for the marketing landing page.
 * The anon/publishable key is safe to expose in the browser when RLS policies restrict writes.
 *
 * Optional overrides (e.g. injected by your host at deploy time):
 *   window.__SHELFYST_SUPABASE_URL__
 *   window.__SHELFYST_SUPABASE_ANON_KEY__
 */
const win = typeof window !== 'undefined' ? window : {};

export const SUPABASE_URL =
  win.__SHELFYST_SUPABASE_URL__ || 'https://gztdihorguiszaidaibi.supabase.co';

export const SUPABASE_ANON_KEY =
  win.__SHELFYST_SUPABASE_ANON_KEY__ ||
  'sb_publishable_fmMG7d9ER7kF0MNHtlwMwQ_TO4F1Tpt';
