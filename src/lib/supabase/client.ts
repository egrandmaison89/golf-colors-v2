import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

/**
 * Supabase client instance.
 * 
 * This is the single source of truth for all Supabase interactions.
 * Components should never import this directly - use feature services instead.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
