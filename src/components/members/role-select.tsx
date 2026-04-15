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
}

export function RoleSelect({
  value,
  onChange,
  includeOwner = false,
}: RoleSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as MemberRole)}
    >
      <SelectTrigger size="sm" className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {includeOwner && <SelectItem value="owner">owner</SelectItem>}
        <SelectItem value="admin">admin</SelectItem>
        <SelectItem value="member">member</SelectItem>
      </SelectContent>
    </Select>
  );
}
