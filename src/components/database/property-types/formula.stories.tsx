import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";
import { FormulaRenderer, FormulaConfigEditor } from "./formula";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeFormulaProp(
  expression: string,
  name = "Total",
): DatabaseProperty {
  return {
    id: "prop-formula",
    database_id: "db-1",
    name,
    type: "formula",
    config: { expression },
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-price",
    database_id: "db-1",
    name: "Price",
    type: "number",
    config: {},
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prop-qty",
    database_id: "db-1",
    name: "Quantity",
    type: "number",
    config: {},
    position: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  makeFormulaProp('prop("Price") * prop("Quantity")'),
];

const mockRow: DatabaseRow = {
  page: {
    id: "row-1",
    title: "Widget A",
    icon: null,
    cover_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: "user-1",
  },
  values: {
    "prop-price": {
      id: "rv-1",
      row_id: "row-1",
      property_id: "prop-price",
      value: { number: 25 },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    "prop-qty": {
      id: "rv-2",
      row_id: "row-1",
      property_id: "prop-qty",
      value: { number: 4 },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  },
};

// ---------------------------------------------------------------------------
// FormulaRenderer stories
// ---------------------------------------------------------------------------

const rendererMeta: Meta<typeof FormulaRenderer> = {
  title: "Database/PropertyTypes/Formula/Renderer",
  component: FormulaRenderer,
  decorators: [
    (Story) => (
      <div className="w-48 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export default rendererMeta;
type RendererStory = StoryObj<typeof FormulaRenderer>;

export const NumberResult: RendererStory = {
  name: "Number result",
  args: {
    value: { _display: "100", _error: null },
    property: makeFormulaProp('prop("Price") * prop("Quantity")'),
  },
};

export const StringResult: RendererStory = {
  name: "String result",
  args: {
    value: { _display: "John Doe", _error: null },
    property: makeFormulaProp('prop("First") + " " + prop("Last")', "Full Name"),
  },
};

export const BooleanResult: RendererStory = {
  name: "Boolean result",
  args: {
    value: { _display: "Yes", _error: null },
    property: makeFormulaProp('prop("Score") >= 80', "Passed"),
  },
};

export const ErrorResult: RendererStory = {
  name: "Error",
  args: {
    value: { _display: null, _error: "Circular reference: A" },
    property: makeFormulaProp('prop("A")', "Broken"),
  },
};

export const EmptyResult: RendererStory = {
  name: "Empty (no expression)",
  args: {
    value: { _display: "", _error: null },
    property: makeFormulaProp(""),
  },
};

// ---------------------------------------------------------------------------
// FormulaConfigEditor stories
// ---------------------------------------------------------------------------

export const ConfigEditorDefault: RendererStory = {
  name: "Config Editor — Default",
  render: () => {
    function ConfigEditorWrapper() {
      const [expression, setExpression] = useState(
        'prop("Price") * prop("Quantity")',
      );
      return (
        <div className="w-80 bg-background p-4">
          <FormulaConfigEditor
            expression={expression}
            onChange={setExpression}
            properties={mockProperties}
            previewRow={mockRow}
          />
        </div>
      );
    }
    return <ConfigEditorWrapper />;
  },
};

export const ConfigEditorEmpty: RendererStory = {
  name: "Config Editor — Empty",
  render: () => {
    function ConfigEditorEmptyWrapper() {
      const [expression, setExpression] = useState("");
      return (
        <div className="w-80 bg-background p-4">
          <FormulaConfigEditor
            expression={expression}
            onChange={setExpression}
            properties={mockProperties}
          />
        </div>
      );
    }
    return <ConfigEditorEmptyWrapper />;
  },
};

export const ConfigEditorWithError: RendererStory = {
  name: "Config Editor — Invalid expression",
  render: () => {
    function ConfigEditorErrorWrapper() {
      const [expression, setExpression] = useState("@invalid");
      return (
        <div className="w-80 bg-background p-4">
          <FormulaConfigEditor
            expression={expression}
            onChange={setExpression}
            properties={mockProperties}
            previewRow={mockRow}
          />
        </div>
      );
    }
    return <ConfigEditorErrorWrapper />;
  },
};
