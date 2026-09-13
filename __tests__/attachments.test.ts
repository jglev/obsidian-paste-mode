import { describe, expect, it } from '@jest/globals';
import type { CommonArguments } from 'obsidian-integration-testing';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { ONE_PIXEL_PNG_BASE64 } from './helpers/fixtures';
import { pasteFilesAndGetResult } from './helpers/e2e-paste';

/**
 * Pastes a base64-encoded PNG embedded in HTML (as opposed to a real pasted
 * file), then reports whether the resulting link points to an attachment
 * that actually exists in the vault. Used by the two
 * `saveBase64EncodedFiles` tests below, which are identical apart from that
 * setting and their expected outcome.
 *
 * This function must remain self-contained (no references outside its own
 * parameters): it is serialized with `toString()` and executed inside the
 * real Obsidian instance.
 */
async function pasteBase64ImageAndCheckAttachment({
  app,
  obsidianModule,
  lib,
  base64Png,
  path,
  pluginId,
  saveBase64EncodedFiles,
}: CommonArguments & {
  base64Png: string;
  path: string;
  pluginId: string;
  saveBase64EncodedFiles: boolean;
}): Promise<{ attachmentExists: boolean; linkText: string }> {
  const plugin = (app as any).plugins.plugins[pluginId];
  await plugin.loadSettings();
  plugin.settings.mode = 'Markdown';
  plugin.settings.saveBase64EncodedFiles = saveBase64EncodedFiles;

  const file = await lib.createNote({ content: '', path });
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
  const editor = view.editor;
  editor.focus();
  editor.setCursor({ ch: 0, line: 0 });

  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', '');
  dataTransfer.setData('text/html', `<img src="data:image/png;base64,${base64Png}">`);

  const clipboardEvent = new ClipboardEvent('paste', { cancelable: true, clipboardData: dataTransfer });
  const before = editor.getValue();
  app.workspace.trigger('editor-paste', clipboardEvent, editor, view);
  await lib.waitUntil({
    message: 'editor content did not change after base64 image paste',
    predicate: () => editor.getValue() !== before,
    timeoutInMilliseconds: 10000,
  });

  const linkText = editor.getValue();
  const linkMatch = linkText.match(/^!\[\]\((.+)\)$/);
  const attachmentExists = linkMatch
    ? app.vault.getAbstractFileByPath(decodeURIComponent(linkMatch[1])) !== null
    : false;

  return { attachmentExists, linkText };
}

describe('attachments', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('saves a pasted image file as an attachment and inserts a link to it', async () => {
    const result = await evalInObsidian({
      callback: pasteFilesAndGetResult,
      input: {
        cursorCh: 0,
        cursorLine: 0,
        files: [{ base64: ONE_PIXEL_PNG_BASE64, name: 'test.png' }],
        initialContent: '',
        mode: 'Text',
        path: 'file-paste.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result.content).toMatch(/^!\[\[Pasted image \d+(?: \d+)?\.png\]\]$/);
    expect(result.allAttachmentsExist).toBe(true);
  });

  it('saves base64-encoded images from pasted HTML as attachments when saveBase64EncodedFiles is enabled', async () => {
    const result = await evalInObsidian({
      callback: pasteBase64ImageAndCheckAttachment,
      input: { base64Png: ONE_PIXEL_PNG_BASE64, path: 'base64-image.md', pluginId, saveBase64EncodedFiles: true },
      vaultPath: vault.path,
    });

    expect(result.linkText).toMatch(/^!\[\]\(Pasted%20image%20\d+(?:%20\d+)?\.png\)$/);
    expect(result.attachmentExists).toBe(true);
  });

  it('does not save base64-encoded images when saveBase64EncodedFiles is disabled', async () => {
    const result = await evalInObsidian({
      callback: pasteBase64ImageAndCheckAttachment,
      input: {
        base64Png: ONE_PIXEL_PNG_BASE64,
        path: 'base64-image-disabled.md',
        pluginId,
        saveBase64EncodedFiles: false,
      },
      vaultPath: vault.path,
    });

    expect(result.linkText).toBe(`![](data:image/png;base64,${ONE_PIXEL_PNG_BASE64})`);
    expect(result.attachmentExists).toBe(false);
  });
});

