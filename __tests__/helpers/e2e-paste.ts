import type { CommonArguments } from 'obsidian-integration-testing';

/**
 * Input for {@link pasteAndGetResult}. Must stay JSON-serializable, since it
 * crosses the Node -> Obsidian boundary as `input`.
 */
export interface PasteTestInput {
  pluginId: string;
  mode: string;
  path: string;
  initialContent: string;
  cursorLine: number;
  cursorCh: number;
  clipboardText?: string;
  clipboardHtml?: string;
  settings?: Record<string, unknown>;
  /**
   * Whether the paste is expected to change the editor's content. Defaults
   * to `true`. Set to `false` for no-op cases (e.g. Passthrough mode), where
   * polling for a change would otherwise time out.
   */
  expectContentChange?: boolean;
}

/**
 * Sets the plugin's mode/settings, creates and opens a note with the cursor at
 * a given position, then triggers Obsidian's `editor-paste` workspace event
 * with a synthetic clipboard payload — the same event the plugin's own
 * "Paste in Mode" commands use (see `pasteInMode` in main.ts) and the same
 * event Obsidian's core paste handling fires from a real paste keystroke.
 * This exercises the plugin's actual registered listener without depending on
 * the OS clipboard or window focus, both of which are unreliable in the
 * harness's hidden, off-screen window. Returns the resulting note content.
 *
 * This function must remain self-contained (no references outside its own
 * parameters): it is serialized with `toString()` and executed inside the
 * real Obsidian instance.
 */
export const pasteAndGetResult = async ({
  app,
  lib,
  obsidianModule,
  pluginId,
  mode,
  path,
  initialContent,
  cursorLine,
  cursorCh,
  clipboardText,
  clipboardHtml,
  settings,
  expectContentChange,
}: CommonArguments & PasteTestInput): Promise<string> => {
  const plugin = (app as any).plugins.plugins[pluginId];
  if (settings) {
    Object.assign(plugin.settings, settings);
  }
  plugin.settings.mode = mode;

  const file = await lib.createNote({ path, content: initialContent });
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);

  const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
  if (!view) {
    throw new Error('No active MarkdownView after opening file');
  }
  const editor = view.editor;
  editor.focus();
  editor.setCursor({ line: cursorLine, ch: cursorCh });

  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', clipboardText ?? '');
  if (clipboardHtml !== undefined) {
    dataTransfer.setData('text/html', clipboardHtml);
  }
  const clipboardEvent = new ClipboardEvent('paste', {
    cancelable: true,
    clipboardData: dataTransfer,
  });

  const before = editor.getValue();
  app.workspace.trigger('editor-paste', clipboardEvent, editor, view);

  if (expectContentChange === false) {
    // Give any (unexpected) async handling a moment to run, then confirm
    // nothing changed, rather than polling for a change that should not
    // happen.
    await new Promise((resolve) => setTimeout(resolve, 200));
  } else {
    await lib.waitUntil({
      message: 'editor content did not change after paste',
      predicate: () => editor.getValue() !== before,
      timeoutInMilliseconds: 10000,
    });
  }

  return editor.getValue();
};

