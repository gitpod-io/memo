import type { Meta, StoryObj } from "@storybook/react";
import { editorTheme } from "./theme";

const meta: Meta = {
  title: "Editor/CodeLanguageSelector",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Static representation of the language selector trigger on a code block. */
function CodeBlockWithLanguage({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <div className="absolute right-2 top-2 z-10" contentEditable={false}>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-overlay-hover rounded-sm"
            aria-label={`Code language: ${language}`}
          >
            {language}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export const JavaScript: Story = {
  render: () => (
    <CodeBlockWithLanguage language="JavaScript">
      <span className={editorTheme.codeHighlight?.keyword}>const</span>{" "}
      <span className={editorTheme.codeHighlight?.variable}>greeting</span>{" "}
      <span className={editorTheme.codeHighlight?.operator}>=</span>{" "}
      <span className={editorTheme.codeHighlight?.string}>
        &quot;Hello, world&quot;
      </span>
      <span className={editorTheme.codeHighlight?.punctuation}>;</span>
      {"\n"}
      <span className={editorTheme.codeHighlight?.builtin}>console</span>
      <span className={editorTheme.codeHighlight?.punctuation}>.</span>
      <span className={editorTheme.codeHighlight?.function}>log</span>
      <span className={editorTheme.codeHighlight?.punctuation}>(</span>
      <span className={editorTheme.codeHighlight?.variable}>greeting</span>
      <span className={editorTheme.codeHighlight?.punctuation}>)</span>
      <span className={editorTheme.codeHighlight?.punctuation}>;</span>
    </CodeBlockWithLanguage>
  ),
};

export const Python: Story = {
  render: () => (
    <CodeBlockWithLanguage language="Python">
      <span className={editorTheme.codeHighlight?.keyword}>def</span>{" "}
      <span className={editorTheme.codeHighlight?.function}>greet</span>
      <span className={editorTheme.codeHighlight?.punctuation}>(</span>
      <span className={editorTheme.codeHighlight?.variable}>name</span>
      <span className={editorTheme.codeHighlight?.punctuation}>)</span>
      <span className={editorTheme.codeHighlight?.punctuation}>:</span>
      {"\n"}
      {"    "}
      <span className={editorTheme.codeHighlight?.builtin}>print</span>
      <span className={editorTheme.codeHighlight?.punctuation}>(</span>
      <span className={editorTheme.codeHighlight?.string}>f&quot;Hello, </span>
      <span className={editorTheme.codeHighlight?.punctuation}>{"{"}</span>
      <span className={editorTheme.codeHighlight?.variable}>name</span>
      <span className={editorTheme.codeHighlight?.punctuation}>{"}"}</span>
      <span className={editorTheme.codeHighlight?.string}>&quot;</span>
      <span className={editorTheme.codeHighlight?.punctuation}>)</span>
    </CodeBlockWithLanguage>
  ),
};

export const TypeScript: Story = {
  render: () => (
    <CodeBlockWithLanguage language="TypeScript">
      <span className={editorTheme.codeHighlight?.keyword}>interface</span>{" "}
      <span className={editorTheme.codeHighlight?.["class-name"]}>User</span>{" "}
      <span className={editorTheme.codeHighlight?.punctuation}>{"{"}</span>
      {"\n"}
      {"  "}
      <span className={editorTheme.codeHighlight?.property}>name</span>
      <span className={editorTheme.codeHighlight?.operator}>:</span>{" "}
      <span className={editorTheme.codeHighlight?.builtin}>string</span>
      <span className={editorTheme.codeHighlight?.punctuation}>;</span>
      {"\n"}
      {"  "}
      <span className={editorTheme.codeHighlight?.property}>age</span>
      <span className={editorTheme.codeHighlight?.operator}>:</span>{" "}
      <span className={editorTheme.codeHighlight?.builtin}>number</span>
      <span className={editorTheme.codeHighlight?.punctuation}>;</span>
      {"\n"}
      <span className={editorTheme.codeHighlight?.punctuation}>{"}"}</span>
    </CodeBlockWithLanguage>
  ),
};

export const PlainText: Story = {
  render: () => (
    <CodeBlockWithLanguage language="Plain Text">
      This is a plain text code block.{"\n"}
      No syntax highlighting is applied.{"\n"}
      Useful for configuration files or logs.
    </CodeBlockWithLanguage>
  ),
};

export const SQL: Story = {
  render: () => (
    <CodeBlockWithLanguage language="SQL">
      <span className={editorTheme.codeHighlight?.keyword}>SELECT</span>{" "}
      <span className={editorTheme.codeHighlight?.variable}>name</span>
      <span className={editorTheme.codeHighlight?.punctuation}>,</span>{" "}
      <span className={editorTheme.codeHighlight?.variable}>email</span>
      {"\n"}
      <span className={editorTheme.codeHighlight?.keyword}>FROM</span>{" "}
      <span className={editorTheme.codeHighlight?.variable}>users</span>
      {"\n"}
      <span className={editorTheme.codeHighlight?.keyword}>WHERE</span>{" "}
      <span className={editorTheme.codeHighlight?.variable}>active</span>{" "}
      <span className={editorTheme.codeHighlight?.operator}>=</span>{" "}
      <span className={editorTheme.codeHighlight?.boolean}>true</span>
      <span className={editorTheme.codeHighlight?.punctuation}>;</span>
    </CodeBlockWithLanguage>
  ),
};

export const WithDropdownOpen: Story = {
  name: "Dropdown Open State",
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <div className="absolute right-2 top-2 z-10" contentEditable={false}>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-foreground bg-overlay-hover rounded-sm"
            aria-expanded="true"
          >
            JavaScript
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div
            role="listbox"
            className="absolute right-0 top-full mt-1 max-h-60 w-40 overflow-y-auto rounded-sm border border-overlay-border bg-popover p-1 shadow-md"
          >
            {[
              "C",
              "C-like",
              "C++",
              "CSS",
              "HTML",
              "Java",
              "JavaScript",
              "Markdown",
              "Objective-C",
              "Plain Text",
              "PowerShell",
              "Python",
              "Rust",
              "SQL",
              "Swift",
              "TypeScript",
              "XML",
            ].map((lang) => (
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
            ))}
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
