import { createBrowserClient } from "@supabase/ssr";

/**
 * Unified browser-side Supabase client for UI modules.
 * Use this file when integrating cloud DB features in client components.
 */
export const createSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
