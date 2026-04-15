"use client";

import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageTree() {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <p className="px-2 text-xs tracking-widest uppercase text-white/30">
        Pages
      </p>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>No pages yet</span>
        </div>
      </div>
      <Button
        variant="ghost"
        className="mt-1 w-full justify-start gap-2 px-2 text-muted-foreground"
        size="sm"
      >
        <Plus className="h-4 w-4" />
        New Page
      </Button>
    </div>
  );
}
