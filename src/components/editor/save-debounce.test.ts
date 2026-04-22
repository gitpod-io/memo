import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for #539: editor auto-save must not run expensive
 * serialization or trigger React state updates on every keystroke.
 * The handleChange callback should only store the EditorState ref and
 * reset the debounce timer — all heavy work belongs in the debounced
 * doSave function.
 */
describe("editor save debounce", () => {
  const editorSource = readFileSync(
    join(__dirname, "editor.tsx"),
    "utf-8",
  );

  it("defines SAVE_DEBOUNCE_MS constant", () => {
    expect(editorSource).toMatch(/const SAVE_DEBOUNCE_MS\s*=\s*\d+/);
  });

  it("sets saving status synchronously for immediate user feedback", () => {
    // The synchronous handleChange body should set "saving" status immediately
    // (cheap state update) but must NOT do serialization — that stays in doSave.
    const handleChangeStart = editorSource.indexOf(
      "(editorState: EditorState) =>",
    );
    const doSaveStart = editorSource.indexOf("const doSave", handleChangeStart);
    expect(handleChangeStart).toBeGreaterThan(-1);
    expect(doSaveStart).toBeGreaterThan(handleChangeStart);

    const synchronousBody = editorSource.slice(handleChangeStart, doSaveStart);
    expect(synchronousBody).toContain('setSaveStatus("saving")');
  });

  it("does not call toJSON() or JSON.stringify in the synchronous handleChange body", () => {
    const handleChangeStart = editorSource.indexOf(
      "(editorState: EditorState) =>",
    );
    const doSaveStart = editorSource.indexOf("const doSave", handleChangeStart);
    const synchronousBody = editorSource.slice(handleChangeStart, doSaveStart);

    // Strip comments so we only check executable code
    const codeOnly = synchronousBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    expect(codeOnly).not.toContain(".toJSON()");
    expect(codeOnly).not.toContain("JSON.stringify");
  });

  it("calls setSaveStatus inside the doSave function", () => {
    const doSaveStart = editorSource.indexOf("const doSave");
    expect(doSaveStart).toBeGreaterThan(-1);

    const afterDoSave = editorSource.slice(doSaveStart);
    expect(afterDoSave).toContain('setSaveStatus("saving")');
    expect(afterDoSave).toContain('setSaveStatus("saved")');
    expect(afterDoSave).toContain('setSaveStatus("error")');
  });

  it("stores EditorState ref for deferred serialization", () => {
    // The handleChange should store the editor state in a ref, not serialize it
    const handleChangeStart = editorSource.indexOf(
      "(editorState: EditorState) =>",
    );
    const doSaveStart = editorSource.indexOf("const doSave", handleChangeStart);
    const synchronousBody = editorSource.slice(handleChangeStart, doSaveStart);

    expect(synchronousBody).toContain("pendingEditorStateRef.current");
  });

  it("uses setTimeout with SAVE_DEBOUNCE_MS for the save timer", () => {
    expect(editorSource).toContain("setTimeout(doSave, SAVE_DEBOUNCE_MS)");
  });
});
