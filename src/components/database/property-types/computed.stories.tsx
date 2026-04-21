import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CreatedTimeRenderer,
  UpdatedTimeRenderer,
  CreatedByRenderer,
} from "./computed";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockMembers = [
  {
    id: "user-1",
    display_name: "Alice Johnson",
    email: "alice@example.com",
    avatar_url: null,
  },
  {
    id: "user-2",
    display_name: "Bob Smith",
    email: "bob@example.com",
    avatar_url: null,
  },
];

function makeTimeProp(
  type: "created_time" | "updated_time",
): DatabaseProperty {
  return {
    id: "prop-ct",
    database_id: "db-1",
    name: type === "created_time" ? "Created" : "Updated",
    type,
    config: {},
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeCreatedByProp(): DatabaseProperty {
  return {
    id: "prop-cb",
    database_id: "db-1",
    name: "Created by",
    type: "created_by",
    config: { _members: mockMembers },
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// CreatedTimeRenderer stories
// ---------------------------------------------------------------------------

const createdTimeMeta: Meta<typeof CreatedTimeRenderer> = {
  title: "Database/PropertyTypes/CreatedTime/Renderer",
  component: CreatedTimeRenderer,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="w-48 bg-background p-2">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};

export default createdTimeMeta;
type CreatedTimeStory = StoryObj<typeof CreatedTimeRenderer>;

export const RecentTimestamp: CreatedTimeStory = {
  name: "Recent (relative)",
  args: {
    value: { created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    property: makeTimeProp("created_time"),
  },
};

export const OlderTimestamp: CreatedTimeStory = {
  name: "Older (absolute)",
  args: {
    value: { created_at: "2026-01-15T10:30:00Z" },
    property: makeTimeProp("created_time"),
  },
};

export const JustNow: CreatedTimeStory = {
  args: {
    value: { created_at: new Date().toISOString() },
    property: makeTimeProp("created_time"),
  },
};

export const Empty: CreatedTimeStory = {
  args: {
    value: {},
    property: makeTimeProp("created_time"),
  },
};

// ---------------------------------------------------------------------------
// UpdatedTimeRenderer stories (separate export block)
// ---------------------------------------------------------------------------

export const UpdatedRecent: CreatedTimeStory = {
  name: "Updated — Recent",
  render: () => (
    <TooltipProvider>
      <div className="w-48 bg-background p-2">
        <UpdatedTimeRenderer
          value={{ updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }}
          property={makeTimeProp("updated_time")}
        />
      </div>
    </TooltipProvider>
  ),
};

export const UpdatedOlder: CreatedTimeStory = {
  name: "Updated — Older",
  render: () => (
    <TooltipProvider>
      <div className="w-48 bg-background p-2">
        <UpdatedTimeRenderer
          value={{ updated_at: "2025-12-01T08:00:00Z" }}
          property={makeTimeProp("updated_time")}
        />
      </div>
    </TooltipProvider>
  ),
};

// ---------------------------------------------------------------------------
// CreatedByRenderer stories
// ---------------------------------------------------------------------------

export const CreatedByKnownUser: CreatedTimeStory = {
  name: "Created By — Known User",
  render: () => (
    <TooltipProvider>
      <div className="w-48 bg-background p-2">
        <CreatedByRenderer
          value={{ created_by: "user-1" }}
          property={makeCreatedByProp()}
        />
      </div>
    </TooltipProvider>
  ),
};

export const CreatedByUnknownUser: CreatedTimeStory = {
  name: "Created By — Unknown User",
  render: () => (
    <TooltipProvider>
      <div className="w-48 bg-background p-2">
        <CreatedByRenderer
          value={{ created_by: "user-unknown" }}
          property={makeCreatedByProp()}
        />
      </div>
    </TooltipProvider>
  ),
};

export const CreatedByEmpty: CreatedTimeStory = {
  name: "Created By — Empty",
  render: () => (
    <TooltipProvider>
      <div className="w-48 bg-background p-2">
        <CreatedByRenderer
          value={{}}
          property={makeCreatedByProp()}
        />
      </div>
    </TooltipProvider>
  ),
};

export const CreatedByNoMembers: CreatedTimeStory = {
  name: "Created By — No Members Data",
  render: () => {
    const prop = makeCreatedByProp();
    prop.config = {};
    return (
      <TooltipProvider>
        <div className="w-48 bg-background p-2">
          <CreatedByRenderer
            value={{ created_by: "user-1" }}
            property={prop}
          />
        </div>
      </TooltipProvider>
    );
  },
};
