import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

// A 1x1 transparent PNG, base64-encoded (68 bytes decoded):
const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('attachments', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('saves a pasted image file as an attachment and inserts a link to it', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, base64Png, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Text';

        const file = await lib.createNote({ content: '', path: 'file-paste.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 0, line: 0 });

        const binary = atob(base64Png);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const pastedFile = new File([bytes], 'test.png', { type: 'image/png' });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(pastedFile);

        const clipboardEvent = new ClipboardEvent('paste', { cancelable: true, clipboardData: dataTransfer });
        const before = editor.getValue();
        app.workspace.trigger('editor-paste', clipboardEvent, editor, view);
        await lib.waitUntil({
          message: 'editor content did not change after file paste',
          predicate: () => editor.getValue() !== before,
          timeoutInMilliseconds: 10000,
        });

        const linkText = editor.getValue();
        const linkMatch = linkText.match(/^!\[\[(.+)\]\]$/);
        const attachmentExists = linkMatch ? app.vault.getAbstractFileByPath(linkMatch[1]) !== null : false;

        return { attachmentExists, linkText };
      },
      input: { base64Png: ONE_PIXEL_PNG_BASE64, pluginId },
      vaultPath: vault.path,
    });

    expect(result.linkText).toMatch(/^!\[\[Pasted image \d+(?: \d+)?\.png\]\]$/);
    expect(result.attachmentExists).toBe(true);
  });

  it('saves base64-encoded images from pasted HTML as attachments when saveBase64EncodedFiles is enabled', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, base64Png, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Markdown';
        plugin.settings.saveBase64EncodedFiles = true;

        const file = await lib.createNote({ content: '', path: 'base64-image.md' });
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
      },
      input: { base64Png: ONE_PIXEL_PNG_BASE64, pluginId },
      vaultPath: vault.path,
    });

    expect(result.linkText).toMatch(/^!\[\]\(Pasted%20image%20\d+(?:%20\d+)?\.png\)$/);
    expect(result.attachmentExists).toBe(true);
  });

  it('does not save base64-encoded images when saveBase64EncodedFiles is disabled', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, base64Png, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Markdown';
        plugin.settings.saveBase64EncodedFiles = false;

        const file = await lib.createNote({ content: '', path: 'base64-image-disabled.md' });
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

        return editor.getValue();
      },
      input: { base64Png: ONE_PIXEL_PNG_BASE64, pluginId },
      vaultPath: vault.path,
    });

    expect(result).toBe(`![](data:image/png;base64,${ONE_PIXEL_PNG_BASE64})`);
  });
});
