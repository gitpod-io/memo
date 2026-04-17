import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase admin client using the secret (service role) key.
 * Used in E2E tests to create/delete temporary test users and query data
 * that bypasses RLS.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set for admin E2E helpers"
    );
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Creates a temporary test user via the Supabase Admin API.
 * The user is auto-confirmed so they can sign in immediately.
 */
export async function createTestUser(
  email: string,
  password: string,
  displayName: string
): Promise<TestUser> {
  const admin = getAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    throw new Error(`Failed to create test user ${email}: ${error.message}`);
  }

  return { id: data.user.id, email, password };
}

/**
 * Deletes a test user and all their data via the Supabase Admin API.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = getAdminClient();

  // Delete memberships first (the user's personal workspace will cascade)
  await admin.from("members").delete().eq("user_id", userId);

  // Delete workspaces created by this user
  await admin.from("workspaces").delete().eq("created_by", userId);

  // Delete profile
  await admin.from("profiles").delete().eq("id", userId);

  // Delete the auth user
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(`Failed to delete test user ${userId}: ${error.message}`);
  }
}

/**
 * Fetches the invite token for a given email and workspace from the database.
 * Bypasses RLS via the admin client.
 */
export async function getInviteToken(
  workspaceId: string,
  email: string
): Promise<string> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("workspace_invites")
    .select("token")
    .eq("workspace_id", workspaceId)
    .ilike("email", email)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `No pending invite found for ${email}: ${error?.message ?? "not found"}`
    );
  }

  return data.token;
}

/**
 * Fetches the workspace ID and slug for a user's first non-personal workspace,
 * or their personal workspace if no team workspaces exist.
 */
export async function getWorkspaceForUser(
  userId: string
): Promise<{ id: string; slug: string }> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("members")
    .select("workspace_id, workspaces(id, slug, is_personal)")
    .eq("user_id", userId)
    .limit(10);

  if (error || !data || data.length === 0) {
    throw new Error(
      `No workspace found for user ${userId}: ${error?.message ?? "no memberships"}`
    );
  }

  // Prefer non-personal workspace, fall back to personal
  for (const row of data) {
    const ws = row.workspaces as unknown as {
      id: string;
      slug: string;
      is_personal: boolean;
    };
    if (!ws.is_personal) {
      return { id: ws.id, slug: ws.slug };
    }
  }

  const ws = data[0].workspaces as unknown as { id: string; slug: string };
  return { id: ws.id, slug: ws.slug };
}

/**
 * Cleans up any pending invites for a given email across all workspaces.
 */
export async function cleanupInvitesForEmail(email: string): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from("workspace_invites")
    .delete()
    .ilike("email", email)
    .is("accepted_at", null);
}

/**
 * Removes stale test users that match a given display name.
 * Used in beforeAll to clean up leftovers from previous test runs whose
 * afterAll cleanup was interrupted (e.g. process killed, timeout).
 * Skips the provided excludeUserId (the current test owner) to avoid
 * accidentally deleting the primary test user.
 */
export async function cleanupStaleTestUsers(
  displayName: string,
  excludeUserId?: string
): Promise<void> {
  const admin = getAdminClient();

  const query = admin
    .from("profiles")
    .select("id")
    .eq("display_name", displayName);

  const { data: staleProfiles } = excludeUserId
    ? await query.neq("id", excludeUserId)
    : await query;

  if (!staleProfiles || staleProfiles.length === 0) return;

  for (const profile of staleProfiles) {
    await deleteTestUser(profile.id).catch((err) => {
      console.warn(`Failed to clean up stale test user ${profile.id}: ${err}`);
    });
  }
}
