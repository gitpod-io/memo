import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import {
  ViewConfigDropdown,
  RowHeightToggle,
  GalleryCardSizeDropdown,
  GalleryCoverDropdown,
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
// RowHeightToggle
// ===========================================================================

export const RowHeightDefault: StoryObj<typeof RowHeightToggle> = {
  render: (args) => <RowHeightToggle {...args} />,
  args: {
    value: "default",
    onChange: fn(),
  },
  parameters: { layout: "centered" },
};

export const RowHeightCompact: StoryObj<typeof RowHeightToggle> = {
  render: (args) => <RowHeightToggle {...args} />,
  args: {
    value: "compact",
    onChange: fn(),
  },
  parameters: { layout: "centered" },
};

export const RowHeightTall: StoryObj<typeof RowHeightToggle> = {
  render: (args) => <RowHeightToggle {...args} />,
  args: {
    value: "tall",
    onChange: fn(),
  },
  parameters: { layout: "centered" },
};

// ===========================================================================
// GalleryCardSizeDropdown
// ===========================================================================

export const CardSizeDefault: StoryObj<typeof GalleryCardSizeDropdown> = {
  render: () => (
    <GalleryCardSizeDropdown cardSize="medium" onCardSizeChange={fn()} />
  ),
  parameters: { layout: "centered" },
};

export const CardSizeSmall: StoryObj<typeof GalleryCardSizeDropdown> = {
  render: () => (
    <GalleryCardSizeDropdown cardSize="small" onCardSizeChange={fn()} />
  ),
  parameters: { layout: "centered" },
};

export const CardSizeLarge: StoryObj<typeof GalleryCardSizeDropdown> = {
  render: () => (
    <GalleryCardSizeDropdown cardSize="large" onCardSizeChange={fn()} />
  ),
  parameters: { layout: "centered" },
};

// ===========================================================================
// GalleryCoverDropdown
// ===========================================================================

const mockFilesProperties: DatabaseProperty[] = [
  {
    id: "files-1",
    database_id: "db-1",
    name: "Attachments",
    type: "files",
    config: {},
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "files-2",
    database_id: "db-1",
    name: "Screenshots",
    type: "files",
    config: {},
    position: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

export const CoverNoneSelected: StoryObj<typeof GalleryCoverDropdown> = {
  render: () => (
    <GalleryCoverDropdown
      selectedId={null}
      options={mockFilesProperties}
      onSelect={fn()}
    />
  ),
  parameters: { layout: "centered" },
};

export const CoverPropertySelected: StoryObj<typeof GalleryCoverDropdown> = {
  render: () => (
    <GalleryCoverDropdown
      selectedId="files-1"
      options={mockFilesProperties}
      onSelect={fn()}
    />
  ),
  parameters: { layout: "centered" },
};

export const CoverNoOptions: StoryObj<typeof GalleryCoverDropdown> = {
  render: () => (
    <GalleryCoverDropdown
      selectedId={null}
      options={[]}
      onSelect={fn()}
    />
  ),
  parameters: { layout: "centered" },
};

// ===========================================================================
// DatabaseSkeleton
// ===========================================================================

export const Skeleton: StoryObj = {
  render: () => <DatabaseSkeleton />,
  parameters: { layout: "padded" },
};
