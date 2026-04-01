import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// In development mode (Vite dev server), Supabase auth is bypassed in favour
// of the x-dev-user-email header.  Allow the app to boot without real
// Supabase credentials so CI / E2E tests don't crash at module load.
if (!import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseAnonKey || "dev-placeholder-key",
);
