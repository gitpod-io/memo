import type { Meta, StoryObj } from "@storybook/react";
import { FileText, StarOff } from "lucide-react";

// FavoritesSection depends on next/navigation and Supabase.
// These stories render the visual appearance with static data.

const meta: Meta = {
  title: "Sidebar/FavoritesSection",
};

export { meta as default };

type Story = StoryObj;

const mockFavorites = [
  { id: "fav-1", pageId: "p1", icon: "📝", title: "Meeting Notes" },
  { id: "fav-2", pageId: "p2", icon: null, title: "Project Roadmap" },
  { id: "fav-3", pageId: "p3", icon: "🚀", title: "Launch Plan" },
];

function FavoriteItem({
  icon,
  title,
  isSelected,
}: {
  icon: string | null;
  title: string;
  isSelected?: boolean;
}) {
  return (
    <div
      className={`group flex items-center gap-2 px-2 py-0.5 text-sm ${
        isSelected
          ? "bg-white/[0.08] font-medium text-white/70"
          : "text-muted-foreground hover:bg-white/[0.04]"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon ? (
          <span className="text-sm">{icon}</span>
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </span>
      <span className="flex-1 truncate text-left">{title}</span>
      <button
        className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
        aria-label="Remove from favorites"
      >
        <StarOff className="h-3 w-3" />
      </button>
    </div>
  );
}

export const WithFavorites: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div className="flex flex-col gap-0.5">
        <p className="px-2 text-xs tracking-widest uppercase text-white/30">
          Favorites
        </p>
        {mockFavorites.map((fav) => (
          <FavoriteItem
            key={fav.id}
            icon={fav.icon}
            title={fav.title}
          />
        ))}
      </div>
    </div>
  ),
};

export const WithSelectedFavorite: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div className="flex flex-col gap-0.5">
        <p className="px-2 text-xs tracking-widest uppercase text-white/30">
          Favorites
        </p>
        <FavoriteItem icon="📝" title="Meeting Notes" isSelected />
        <FavoriteItem icon={null} title="Project Roadmap" />
        <FavoriteItem icon="🚀" title="Launch Plan" />
      </div>
    </div>
  ),
};

export const SingleFavorite: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div className="flex flex-col gap-0.5">
        <p className="px-2 text-xs tracking-widest uppercase text-white/30">
          Favorites
        </p>
        <FavoriteItem icon="📝" title="Meeting Notes" />
      </div>
    </div>
  ),
};

export const Empty: Story = {
  name: "Empty (hidden)",
  render: () => (
    <div className="w-56 bg-muted p-2">
      <p className="px-2 text-xs text-muted-foreground">
        (Favorites section is hidden when empty)
      </p>
    </div>
  ),
};
