import type { SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<() => SupabaseClient> | null = null;

/**
 * Lazily import and create a Supabase browser client. The full SDK
 * (~59 kB gzipped) is loaded on first call instead of at module
 * evaluation time, keeping it out of the initial page JS.
 */
export async function getClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("@/lib/supabase/client").then(
      (mod) => mod.createClient,
    );
  }
  const createClient = await clientPromise;
  return createClient();
}
