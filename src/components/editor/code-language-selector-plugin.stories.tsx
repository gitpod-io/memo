import type { Meta, StoryObj } from "@storybook/react";
import { ChevronDown } from "lucide-react";
import { editorTheme } from "./theme";

// The CodeLanguageSelectorPlugin renders a language dropdown on focused code
// blocks via a portal. It requires Lexical context — stories show the static
// visual output of the dropdown trigger and open state.

const meta: Meta = {
  title: "Editor/CodeLanguageSelectorPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function LanguageTrigger({
  language,
  expanded = false,
}: {
  language: string;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-sm ${
        expanded
          ? "text-foreground bg-overlay-hover"
          : "text-muted-foreground hover:text-foreground hover:bg-overlay-hover"
      }`}
      aria-label={`Code language: ${language}`}
      aria-expanded={expanded}
    >
      {language}
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}

/** Language selector trigger shown on a focused code block. */
export const TriggerButton: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <div className="absolute right-2 top-2 z-10" contentEditable={false}>
          <LanguageTrigger language="JavaScript" />
        </div>
        <code>
          <span className={editorTheme.codeHighlight?.keyword}>const</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>x</span>{" "}
          <span className={editorTheme.codeHighlight?.operator}>=</span>{" "}
          <span className={editorTheme.codeHighlight?.number}>42</span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
        </code>
      </pre>
    </div>
  ),
};

/** Dropdown open with language list and current selection highlighted. */
export const DropdownOpen: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <div className="absolute right-2 top-2 z-10" contentEditable={false}>
          <LanguageTrigger language="JavaScript" expanded />
          <div
            role="listbox"
            className="absolute right-0 top-full mt-1 max-h-60 w-40 overflow-y-auto rounded-sm border border-overlay-border bg-popover p-1 shadow-md"
          >
            {["C", "CSS", "HTML", "Java", "JavaScript", "Python", "SQL", "TypeScript"].map(
              (lang) => (
                <button
                  key={lang}
                  type="button"
                  role="option"
                  aria-selected={lang === "JavaScript"}
                  className={`flex w-full items-center px-2 py-1 text-left text-xs ${
                    lang === "JavaScript"
                      ? "text-foreground bg-overlay-active"
                      : "text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
                  }`}
                >
                  {lang}
                </button>
              ),
            )}
          </div>
        </div>
        <code>
          <span className={editorTheme.codeHighlight?.keyword}>const</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>x</span>{" "}
          <span className={editorTheme.codeHighlight?.operator}>=</span>{" "}
          <span className={editorTheme.codeHighlight?.number}>42</span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
        </code>
      </pre>
    </div>
  ),
};

/** Plain Text selected — no syntax highlighting. */
export const PlainTextSelected: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <div className="absolute right-2 top-2 z-10" contentEditable={false}>
          <LanguageTrigger language="Plain Text" />
        </div>
        <code>No syntax highlighting applied to this block.</code>
      </pre>
    </div>
  ),
};
