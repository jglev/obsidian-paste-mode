import type { CommonArguments } from 'obsidian-integration-testing';

import type { PastetoIndentationPluginSettings } from '../../main';

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
  settings?: Partial<PastetoIndentationPluginSettings>;
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
  // Reset settings to their defaults before applying this test's overrides.
  // Without this, settings mutated by an earlier test (e.g.
  // `continueListItems: true`) would otherwise leak into later tests that
  // don't explicitly specify every setting, since the plugin instance (and
  // its settings object) is shared across the whole test run.
  await plugin.loadSettings();
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

/**
 * Input for {@link pasteFilesAndGetResult}. Must stay JSON-serializable,
 * since it crosses the Node -> Obsidian boundary as `input` — files are
 * therefore passed as base64 strings rather than `File`/`Blob` instances.
 */
export interface PasteFilesTestInput {
  pluginId: string;
  mode: string;
  path: string;
  initialContent?: string;
  cursorLine: number;
  cursorCh: number;
  clipboardText?: string;
  settings?: Partial<PastetoIndentationPluginSettings>;
  /** Files to add to the clipboard's `DataTransfer.items`, simulating a pasted file/image. */
  files: { base64: string; name: string; type?: string }[];
}

/**
 * Like {@link pasteAndGetResult}, but simulates pasting one or more files
 * (e.g. images) via the clipboard's `DataTransfer.items`, instead of plain
 * text/HTML. Returns the resulting note content, the paths of any
 * `![[...]]`/`![...](...)` attachment links found in it, and whether every
 * one of those linked files actually exists in the vault.
 *
 * This function must remain self-contained (no references outside its own
 * parameters): it is serialized with `toString()` and executed inside the
 * real Obsidian instance.
 */
export const pasteFilesAndGetResult = async ({
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
  settings,
  files,
}: CommonArguments & PasteFilesTestInput): Promise<{
  content: string;
  linkedPaths: string[];
  allAttachmentsExist: boolean;
}> => {
  const plugin = (app as any).plugins.plugins[pluginId];
  // See the matching comment in pasteAndGetResult: the plugin instance (and
  // its settings) is shared across the whole test run, so settings must be
  // reset before applying this test's overrides.
  await plugin.loadSettings();
  if (settings) {
    Object.assign(plugin.settings, settings);
  }
  plugin.settings.mode = mode;

  const file = await lib.createNote({ path, content: initialContent ?? '' });
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
  if (clipboardText !== undefined) {
    dataTransfer.setData('text/plain', clipboardText);
  }
  for (const { base64, name, type } of files) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    dataTransfer.items.add(new File([bytes], name, { type: type ?? 'image/png' }));
  }

  const clipboardEvent = new ClipboardEvent('paste', {
    cancelable: true,
    clipboardData: dataTransfer,
  });

  const before = editor.getValue();
  app.workspace.trigger('editor-paste', clipboardEvent, editor, view);

  await lib.waitUntil({
    message: 'editor content did not change after file paste',
    predicate: () => editor.getValue() !== before,
    timeoutInMilliseconds: 10000,
  });

  const content = editor.getValue();
  const linkedPaths = [
    ...[...content.matchAll(/!\[\[([^\]]+)\]\]/g)].map((match) => match[1]),
    ...[...content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => decodeURIComponent(match[1])),
  ];
  const allAttachmentsExist =
    linkedPaths.length > 0 && linkedPaths.every((linkedPath) => app.vault.getAbstractFileByPath(linkedPath) !== null);

  return { content, linkedPaths, allAttachmentsExist };
};

