"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsTabNavProps {
  workspaceSlug: string;
}

const tabs = [
  { label: "General", segment: "" },
  { label: "Members", segment: "/members" },
] as const;

export function SettingsTabNav({ workspaceSlug }: SettingsTabNavProps) {
  const pathname = usePathname();
  const basePath = `/${workspaceSlug}/settings`;

  return (
    <nav className="flex border-b border-overlay-border">
      {tabs.map((tab) => {
        const href = `${basePath}${tab.segment}`;
        const isActive =
          tab.segment === ""
            ? pathname === basePath
            : pathname === `${basePath}${tab.segment}`;

        return (
          <Link
            key={tab.label}
            href={href}
            className={`px-3 pb-2 text-sm ${
              isActive
                ? "border-b-2 border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
