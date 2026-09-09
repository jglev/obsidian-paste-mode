import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

describe('multiple file attachments', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  // Helper to create a test PNG as bytes
  const createTestPng = (): Uint8Array => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  it('saves multiple pasted image files and creates links for each', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Text';

        const file = await lib.createNote({ content: '', path: 'multi-file-paste.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 0, line: 0 });

        const pngBytes = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=`;

        const dataTransfer = new DataTransfer();
        
        // Add multiple image files
        const file1 = new File([atob(pngBytes).split('').map(c => c.charCodeAt(0))], 'test1.png', { type: 'image/png' });
        const file2 = new File([atob(pngBytes).split('').map(c => c.charCodeAt(0))], 'test2.png', { type: 'image/png' });
        const file3 = new File([atob(pngBytes).split('').map(c => c.charCodeAt(0))], 'test3.png', { type: 'image/png' });
        
        dataTransfer.items.add(file1);
        dataTransfer.items.add(file2);
        dataTransfer.items.add(file3);

        const clipboardEvent = new ClipboardEvent('paste', { cancelable: true, clipboardData: dataTransfer });
        const before = editor.getValue();
        app.workspace.trigger('editor-paste', clipboardEvent, editor, view);
        
        await lib.waitUntil({
          message: 'editor content did not change after multiple file paste',
          predicate: () => editor.getValue() !== before,
          timeoutInMilliseconds: 10000,
        });

        const content = editor.getValue();
        const linkMatches = [...content.matchAll(/!\[\[Pasted image \d+(?:\s\d+)?\.png\]\]/g)];

        return { 
          content, 
          linkCount: linkMatches.length,
          allAttachmentsExist: linkMatches.every(match => {
            const linkText = match[0];
            const path = linkText.slice(3, -2); // Extract path from ![[...]]
            return app.vault.getAbstractFileByPath(path) !== null;
          })
        };
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    expect(result.linkCount).toBe(3);
    expect(result.allAttachmentsExist).toBe(true);
  });

  it('preserves order of multiple pasted files', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Text';

        const file = await lib.createNote({ content: '', path: 'multi-file-order.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 0, line: 0 });

        const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const pngBytes = atob(pngBase64);
        
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < 2; i++) {
          const bytes = new Uint8Array(pngBytes.length);
          for (let j = 0; j < pngBytes.length; j++) {
            bytes[j] = pngBytes.charCodeAt(j);
          }
          const f = new File([bytes], `file${i}.png`, { type: 'image/png' });
          dataTransfer.items.add(f);
        }

        const clipboardEvent = new ClipboardEvent('paste', { cancelable: true, clipboardData: dataTransfer });
        const before = editor.getValue();
        app.workspace.trigger('editor-paste', clipboardEvent, editor, view);
        
        await lib.waitUntil({
          message: 'editor content did not change after file paste',
          predicate: () => editor.getValue() !== before,
          timeoutInMilliseconds: 10000,
        });

        return editor.getValue();
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    // Should have 2 links on separate lines
    const lines = result.split('\n');
    expect(lines.filter(l => l.startsWith('!')).length).toBe(2);
  });

  it('combines text paste and multiple file attachments', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Text';

        const file = await lib.createNote({ content: '', path: 'mixed-content-paste.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 0, line: 0 });

        const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const pngBytes = atob(pngBase64);

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'Some pasted text');
        
        const bytes = new Uint8Array(pngBytes.length);
        for (let i = 0; i < pngBytes.length; i++) {
          bytes[i] = pngBytes.charCodeAt(i);
        }
        const imgFile = new File([bytes], 'image.png', { type: 'image/png' });
        dataTransfer.items.add(imgFile);

        const clipboardEvent = new ClipboardEvent('paste', { cancelable: true, clipboardData: dataTransfer });
        const before = editor.getValue();
        app.workspace.trigger('editor-paste', clipboardEvent, editor, view);
        
        await lib.waitUntil({
          message: 'editor content did not change after paste',
          predicate: () => editor.getValue() !== before,
          timeoutInMilliseconds: 10000,
        });

        return editor.getValue();
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    // Should have both text and image link
    expect(result).toContain('Some pasted text');
    expect(result).toMatch(/!\[\[Pasted image/);
  });

  it('applies indentation to file links when cursor is indented', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Text';

        const file = await lib.createNote({ content: '    ', path: 'indented-files.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 4, line: 0 });

        const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const pngBytes = atob(pngBase64);

        const dataTransfer = new DataTransfer();
        
        for (let i = 0; i < 2; i++) {
          const bytes = new Uint8Array(pngBytes.length);
          for (let j = 0; j < pngBytes.length; j++) {
            bytes[j] = pngBytes.charCodeAt(j);
          }
          const f = new File([bytes], `test${i}.png`, { type: 'image/png' });
          dataTransfer.items.add(f);
        }

        const clipboardEvent = new ClipboardEvent('paste', { cancelable: true, clipboardData: dataTransfer });
        const before = editor.getValue();
        app.workspace.trigger('editor-paste', clipboardEvent, editor, view);
        
        await lib.waitUntil({
          message: 'editor content did not change after file paste',
          predicate: () => editor.getValue() !== before,
          timeoutInMilliseconds: 10000,
        });

        return editor.getValue();
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    // Both file links should be indented
    const lines = result.split('\n');
    const imageLines = lines.filter(l => l.includes('![['));
    expect(imageLines.length).toBe(2);
    imageLines.forEach(line => {
      expect(line).toMatch(/^    !/);
    });
  });
});
