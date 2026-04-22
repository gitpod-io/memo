import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty } from "@/lib/types";
import { FilesRenderer, FilesEditor } from "./files";

const mockProperty: DatabaseProperty = {
  id: "prop-1",
  database_id: "db-1",
  name: "Attachments",
  type: "files",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Use placeholder images for stories (no real uploads)
const sampleImages = {
  files: [
    { name: "photo.jpg", url: "https://picsum.photos/seed/a/200/200" },
    { name: "banner.png", url: "https://picsum.photos/seed/b/200/200" },
  ],
};

const sampleMixed = {
  files: [
    { name: "photo.jpg", url: "https://picsum.photos/seed/c/200/200" },
    { name: "report.pdf", url: "https://example.com/report.pdf" },
    { name: "data.csv", url: "https://example.com/data.csv" },
  ],
};

const sampleOverflow = {
  files: [
    { name: "img1.jpg", url: "https://picsum.photos/seed/d/200/200" },
    { name: "img2.png", url: "https://picsum.photos/seed/e/200/200" },
    { name: "img3.gif", url: "https://picsum.photos/seed/f/200/200" },
    { name: "doc.pdf", url: "https://example.com/doc.pdf" },
    { name: "notes.txt", url: "https://example.com/notes.txt" },
  ],
};

const meta: Meta<typeof FilesRenderer> = {
  title: "Database/PropertyTypes/Files/Renderer",
  component: FilesRenderer,
  decorators: [
    (Story) => (
      <div className="w-56 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof FilesRenderer>;

export const Images: Story = {
  args: {
    value: sampleImages,
    property: mockProperty,
  },
};

export const MixedFiles: Story = {
  args: {
    value: sampleMixed,
    property: mockProperty,
  },
};

export const Overflow: Story = {
  args: {
    value: sampleOverflow,
    property: mockProperty,
  },
};

export const SingleFile: Story = {
  args: {
    value: { files: [{ name: "document.pdf", url: "https://example.com/doc.pdf" }] },
    property: mockProperty,
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: mockProperty,
  },
};

function FilesEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>(sampleMixed);
  return (
    <div className="w-72 bg-background p-2">
      <FilesEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <FilesEditorDemo />,
};

function FilesEditorEmptyDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({});
  return (
    <div className="w-72 bg-background p-2">
      <FilesEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const EditorEmpty: Story = {
  render: () => <FilesEditorEmptyDemo />,
};
