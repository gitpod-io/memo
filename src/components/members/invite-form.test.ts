import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Static analysis tests for invite-form.tsx to prevent regressions
 * where the onInviteSent callback loses its invite data parameter.
 *
 * The bug (#243): InviteForm called onInviteSent() with no arguments after
 * creating an invite. MembersPage used onInviteSent as () => router.refresh(),
 * which is async and fire-and-forget. The pending invites list didn't update
 * until the refresh completed (or on the next navigation). The fix passes the
 * created invite back so MembersPage can optimistically add it to the list.
 */

const INVITE_FORM_PATH = join(__dirname, "invite-form.tsx");
const MEMBERS_PAGE_PATH = join(__dirname, "members-page.tsx");

describe("invite-form: onInviteSent passes invite data", () => {
  const inviteFormSource = readFileSync(INVITE_FORM_PATH, "utf-8");
  const membersPageSource = readFileSync(MEMBERS_PAGE_PATH, "utf-8");

  it("InviteForm onInviteSent callback accepts WorkspaceInviteWithInviter", () => {
    // The callback type must accept invite data, not be a void callback
    expect(inviteFormSource).toContain(
      "onInviteSent: (invite: WorkspaceInviteWithInviter) => void"
    );
  });

  it("InviteForm insert uses .select().single() to return the created row", () => {
    // The insert must chain .select().single() to get the created invite back
    expect(inviteFormSource).toMatch(/\.insert\([\s\S]*?\)\s*\.select\(\)\s*\.single\(\)/);
  });

  it("InviteForm calls onInviteSent with invite data", () => {
    // onInviteSent must be called with an object spread, not with no arguments
    expect(inviteFormSource).toMatch(/onInviteSent\(\{/);
    expect(inviteFormSource).not.toMatch(/onInviteSent\(\)\s*;/);
  });

  it("MembersPage optimistically adds new invite to local state", () => {
    // The onInviteSent handler must call setInvites to add the new invite
    expect(membersPageSource).toMatch(/setInvites\(/);
    expect(membersPageSource).toContain("onInviteSent");
  });
});
