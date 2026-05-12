"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemberRole } from "@/lib/types";

interface RoleSelectProps {
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  includeOwner?: boolean;
  "data-testid"?: string;
}

export function RoleSelect({
  value,
  onChange,
  includeOwner = false,
  "data-testid": testId,
}: RoleSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as MemberRole)}
    >
      <SelectTrigger size="sm" className="w-28" aria-label="Member role" data-testid={testId ?? "members-role-select-trigger"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {includeOwner && <SelectItem value="owner" data-testid="members-role-option-owner">owner</SelectItem>}
        <SelectItem value="admin" data-testid="members-role-option-admin">admin</SelectItem>
        <SelectItem value="member" data-testid="members-role-option-member">member</SelectItem>
      </SelectContent>
    </Select>
  );
}
