import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import {
  ViewConfigDropdown,
  ComingSoonPlaceholder,
  DatabaseSkeleton,
} from "./database-view-helpers";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-1",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: {},
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prop-2",
    database_id: "db-1",
    name: "Priority",
    type: "select",
    config: {},
    position: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prop-3",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 2,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

// ===========================================================================
// ViewConfigDropdown
// ===========================================================================

const dropdownMeta: Meta<typeof ViewConfigDropdown> = {
  title: "Database/ViewConfigDropdown",
  component: ViewConfigDropdown,
  parameters: { layout: "centered" },
  args: {
    label: "Group by",
    selectedId: null,
    options: mockProperties,
    onSelect: fn(),
  },
};

export { dropdownMeta as default };

type DropdownStory = StoryObj<typeof ViewConfigDropdown>;

/** No property selected — shows "None". */
export const Default: DropdownStory = {};

/** A property is pre-selected. */
export const WithSelection: DropdownStory = {
  args: {
    selectedId: "prop-1",
  },
};

/** No options available — shows empty state. */
export const EmptyOptions: DropdownStory = {
  args: {
    options: [],
  },
};

/** Date property label variant. */
export const DatePropertyLabel: DropdownStory = {
  args: {
    label: "Date property",
    options: mockProperties.filter((p) => p.type === "date"),
    selectedId: "prop-3",
  },
};

// ===========================================================================
// ComingSoonPlaceholder — separate story file section
// ===========================================================================

export const ComingSoonBoard: StoryObj = {
  render: () => <ComingSoonPlaceholder viewType="board" />,
  parameters: { layout: "padded" },
};

export const ComingSoonCalendar: StoryObj = {
  render: () => <ComingSoonPlaceholder viewType="calendar" />,
  parameters: { layout: "padded" },
};

export const ComingSoonGallery: StoryObj = {
  render: () => <ComingSoonPlaceholder viewType="gallery" />,
  parameters: { layout: "padded" },
};

// ===========================================================================
// DatabaseSkeleton
// ===========================================================================

export const Skeleton: StoryObj = {
  render: () => <DatabaseSkeleton />,
  parameters: { layout: "padded" },
};
