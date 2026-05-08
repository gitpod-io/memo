import type { Meta, StoryObj } from "@storybook/react";
import { Check, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// InviteForm depends on Supabase and clipboard API.
// These stories render the visual form states with static markup.

const meta: Meta = {
  title: "Members/InviteForm",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

export const Empty: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-label-faint">Invite</p>
      <form className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email-empty">Email</Label>
          <Input
            id="invite-email-empty"
            type="email"
            placeholder="colleague@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role-empty">Role</Label>
          <Select defaultValue="member">
            <SelectTrigger size="sm" className="w-28" aria-label="Invite role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm">
          <Send className="h-4 w-4" />
          Invite
        </Button>
      </form>
    </div>
  ),
};

export const Filled: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-label-faint">Invite</p>
      <form className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email-filled">Email</Label>
          <Input
            id="invite-email-filled"
            type="email"
            defaultValue="dave@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role-filled">Role</Label>
          <Select defaultValue="admin">
            <SelectTrigger size="sm" className="w-28" aria-label="Invite role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm">
          <Send className="h-4 w-4" />
          Invite
        </Button>
      </form>
    </div>
  ),
};

export const Submitting: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-label-faint">Invite</p>
      <form className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email-sending">Email</Label>
          <Input
            id="invite-email-sending"
            type="email"
            defaultValue="dave@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role-sending">Role</Label>
          <Select defaultValue="member">
            <SelectTrigger size="sm" className="w-28" aria-label="Invite role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" disabled>
          <Send className="h-4 w-4" />
          Sending…
        </Button>
      </form>
    </div>
  ),
};

export const WithInviteLink: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-label-faint">Invite</p>
      <form className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email-link">Email</Label>
          <Input
            id="invite-email-link"
            type="email"
            placeholder="colleague@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role-link">Role</Label>
          <Select defaultValue="member">
            <SelectTrigger size="sm" className="w-28" aria-label="Invite role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm">
          <Send className="h-4 w-4" />
          Invite
        </Button>
      </form>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-accent">
          https://memo.software-factory.dev/invite/abc-123-def-456
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Copy invite link">
          <Copy className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  ),
};

export const LinkCopied: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-label-faint">Invite</p>
      <form className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email-copied">Email</Label>
          <Input
            id="invite-email-copied"
            type="email"
            placeholder="colleague@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role-copied">Role</Label>
          <Select defaultValue="member">
            <SelectTrigger size="sm" className="w-28" aria-label="Invite role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm">
          <Send className="h-4 w-4" />
          Invite
        </Button>
      </form>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-accent">
          https://memo.software-factory.dev/invite/abc-123-def-456
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Copy invite link">
          <Check className="h-4 w-4 text-accent" />
        </Button>
      </div>
    </div>
  ),
};
