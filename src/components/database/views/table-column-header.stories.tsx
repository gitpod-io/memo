import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { TableColumnHeader } from "./table-column-header";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const ts = "2026-04-01T00:00:00Z";

const textProp: DatabaseProperty = {
  id: "prop-name",
  database_id: "db-1",
  name: "Name",
  type: "text",
  config: {},
  position: 0,
  created_at: ts,
  updated_at: ts,
};

const selectProp: DatabaseProperty = {
  id: "prop-status",
  database_id: "db-1",
  name: "Status",
  type: "select",
  config: {},
  position: 1,
  created_at: ts,
  updated_at: ts,
};

const dateProp: DatabaseProperty = {
  id: "prop-due",
  database_id: "db-1",
  name: "Due Date",
  type: "date",
  config: {},
  position: 2,
  created_at: ts,
  updated_at: ts,
};

const numberProp: DatabaseProperty = {
  id: "prop-amount",
  database_id: "db-1",
  name: "Amount",
  type: "number",
  config: {},
  position: 3,
  created_at: ts,
  updated_at: ts,
};

const numberCurrencyProp: DatabaseProperty = {
  id: "prop-price",
  database_id: "db-1",
  name: "Price",
  type: "number",
  config: { format: "currency" },
  position: 4,
  created_at: ts,
  updated_at: ts,
};

const defaultHandlers = {
  onDragStart: fn(),
  onDragEnd: fn(),
  onDragOver: fn(),
  onDrop: fn(),
  onResizeStart: fn(),
  onResizeAutoFit: fn(),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof TableColumnHeader> = {
  title: "Database/TableColumnHeader",
  component: TableColumnHeader,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-48 bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    colIndex: 0,
    sortRule: undefined,
    isDragging: false,
    showDropBefore: false,
    showDropAfter: false,
    resizingColumn: null,
    ...defaultHandlers,
  },
};

export { meta as default };

type Story = StoryObj<typeof TableColumnHeader>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    property: textProp,
  },
};

export const WithSortAsc: Story = {
  name: "Sorted ascending",
  args: {
    property: selectProp,
    sortRule: { property_id: selectProp.id, direction: "asc" },
    onSortToggle: fn(),
  },
};

export const WithSortDesc: Story = {
  name: "Sorted descending",
  args: {
    property: selectProp,
    sortRule: { property_id: selectProp.id, direction: "desc" },
    onSortToggle: fn(),
  },
};

export const WithMenu: Story = {
  name: "With column menu",
  args: {
    property: dateProp,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
  },
};

export const MenuRenameOnly: Story = {
  name: "Menu (rename only)",
  args: {
    property: dateProp,
    onColumnHeaderClick: fn(),
  },
};

export const Dragging: Story = {
  name: "Dragging state",
  args: {
    property: textProp,
    isDragging: true,
    onColumnReorder: fn(),
  },
};

export const DropIndicatorBefore: Story = {
  name: "Drop indicator (before)",
  args: {
    property: selectProp,
    showDropBefore: true,
  },
};

export const DropIndicatorAfter: Story = {
  name: "Drop indicator (after)",
  args: {
    property: selectProp,
    showDropAfter: true,
  },
};

export const Resizing: Story = {
  name: "Resize handle active",
  args: {
    property: textProp,
    resizingColumn: textProp.id,
  },
};

export const Draggable: Story = {
  name: "Draggable (cursor grab)",
  args: {
    property: textProp,
    onColumnReorder: fn(),
  },
};

export const TitleColumn: Story = {
  name: "Title column (position 0, no delete)",
  args: {
    property: textProp,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
  },
};

export const NumberFormatMenu: Story = {
  name: "Number column with format options",
  args: {
    property: numberProp,
    colIndex: 3,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
    onPropertyConfigChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-48 bg-background" style={{ minHeight: 300 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the column header dropdown menu
    const menuTrigger = canvas.getByLabelText("Amount column menu");
    await userEvent.click(menuTrigger);

    // Verify "Number format" label and format options are visible
    await waitFor(() => {
      expect(
        within(document.body).getByText("Number format"),
      ).toBeInTheDocument();
      expect(within(document.body).getByText("Number")).toBeInTheDocument();
      expect(
        within(document.body).getByText("Currency ($)"),
      ).toBeInTheDocument();
      expect(
        within(document.body).getByText("Percent (%)"),
      ).toBeInTheDocument();
    });
  },
};

export const NumberFormatCurrencySelected: Story = {
  name: "Number format with currency selected",
  args: {
    property: numberCurrencyProp,
    colIndex: 4,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
    onPropertyConfigChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-48 bg-background" style={{ minHeight: 300 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the column header dropdown menu
    const menuTrigger = canvas.getByLabelText("Price column menu");
    await userEvent.click(menuTrigger);

    // Verify the format options are visible with currency checked
    await waitFor(() => {
      expect(
        within(document.body).getByText("Number format"),
      ).toBeInTheDocument();
      expect(
        within(document.body).getByText("Currency ($)"),
      ).toBeInTheDocument();
    });
  },
};

export const DateFormatMenu: Story = {
  name: "Date format submenu",
  args: {
    property: dateProp,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
    onPropertyConfigChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-48 bg-background" style={{ minHeight: 300 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the column header dropdown menu
    const menuTrigger = canvas.getByLabelText("Due Date column menu");
    await userEvent.click(menuTrigger);

    // Open the "Date format" submenu
    const dateFormatItem = await waitFor(() =>
      within(document.body).getByText("Date format"),
    );
    await userEvent.click(dateFormatItem);

    // Verify format options are visible
    await waitFor(() => {
      expect(within(document.body).getByText("Full")).toBeInTheDocument();
      expect(within(document.body).getByText("Short")).toBeInTheDocument();
      expect(within(document.body).getByText("ISO")).toBeInTheDocument();
      expect(within(document.body).getByText("Slash")).toBeInTheDocument();
    });
  },
};

export const DateFormatMenuWithISOSelected: Story = {
  name: "Date format submenu (ISO selected)",
  args: {
    property: {
      ...dateProp,
      config: { date_format: "iso" },
    },
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
    onPropertyConfigChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-48 bg-background" style={{ minHeight: 300 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the column header dropdown menu
    const menuTrigger = canvas.getByLabelText("Due Date column menu");
    await userEvent.click(menuTrigger);

    // Open the "Date format" submenu
    const dateFormatItem = await waitFor(() =>
      within(document.body).getByText("Date format"),
    );
    await userEvent.click(dateFormatItem);

    // Verify all format options are visible
    await waitFor(() => {
      expect(within(document.body).getByText("ISO")).toBeInTheDocument();
    });
  },
};

export const DeleteConfirmation: Story = {
  name: "Delete confirmation dialog",
  args: {
    property: dateProp,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-48 bg-background" style={{ minHeight: 300 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the column header dropdown menu
    const menuTrigger = canvas.getByLabelText("Due Date column menu");
    await userEvent.click(menuTrigger);

    // Click "Delete property" to open the confirmation dialog
    const deleteItem = await waitFor(() =>
      within(document.body).getByText("Delete property"),
    );
    await userEvent.click(deleteItem);

    // Verify the confirmation dialog is visible
    await waitFor(() => {
      const dialog = within(document.body).getByText(
        /All row values for this column will be permanently deleted/,
      );
      expect(dialog).toBeInTheDocument();
    });
  },
};
