"use client";

import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceSwitcherProps {
  workspaceName: string;
}

export function WorkspaceSwitcher({ workspaceName }: WorkspaceSwitcherProps) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-between gap-2 px-2"
      size="sm"
      aria-label="Switch workspace"
    >
      <span className="truncate text-sm font-medium">{workspaceName}</span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Button>
  );
}
