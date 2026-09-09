import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('list continuation edge cases', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('continues bullet lists with unchecked checkboxes', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Task two\nTask three',
        cursorCh: 6,
        cursorLine: 1,
        initialContent: '- [ ] Task one\n- [ ] ',
        mode: 'Text',
        path: 'list-checkbox-unchecked.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('- [ ] Task one\n- [ ] Task two\n- [ ] Task three');
  });

  it('continues bullet lists with checked checkboxes', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Task two\nTask three',
        cursorCh: 6,
        cursorLine: 1,
        initialContent: '- [x] Task one\n- [x] ',
        mode: 'Text',
        path: 'list-checkbox-checked.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('- [x] Task one\n- [x] Task two\n- [x] Task three');
  });

  it('continues bullet lists with uppercase X in checkbox', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Done two',
        cursorCh: 6,
        cursorLine: 1,
        initialContent: '- [X] Done one\n- [X] ',
        mode: 'Text',
        path: 'list-checkbox-uppercase-x.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('- [X] Done one\n- [X] Done two');
  });

  it('handles empty lines within pasted content going into list', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item two\n\nItem three',
        cursorCh: 2,
        cursorLine: 1,
        initialContent: '- Item one\n- ',
        mode: 'Text',
        path: 'list-empty-lines.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    // Empty lines might break list continuation - verify behavior
    const lines = result.split('\n');
    expect(lines[0]).toBe('- Item one');
    expect(lines[1]).toMatch(/^- Item two/);
  });

  it('continues list with different bullet markers (- vs * vs +)', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item two\nItem three',
        cursorCh: 2,
        cursorLine: 1,
        initialContent: '* Item one\n* ',
        mode: 'Text',
        path: 'list-asterisk-marker.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('* Item one\n* Item two\n* Item three');
  });

  it('continues list with plus marker', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item two\nItem three',
        cursorCh: 2,
        cursorLine: 1,
        initialContent: '+ Item one\n+ ',
        mode: 'Text',
        path: 'list-plus-marker.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('+ Item one\n+ Item two\n+ Item three');
  });

  it('increments numbered list starting from different numbers', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item\nAnother',
        cursorCh: 3,
        cursorLine: 1,
        initialContent: '5. First\n5. ',
        mode: 'Text',
        path: 'list-numbered-start.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('5. First\n6. Item\n7. Another');
  });

  it('handles numbered list with checkboxes', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Task two\nTask three',
        cursorCh: 7,
        cursorLine: 1,
        initialContent: '1. [ ] Task one\n1. [ ] ',
        mode: 'Text',
        path: 'list-numbered-checkbox.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('1. [ ] Task one\n2. [ ] Task two\n3. [ ] Task three');
  });

  it('applies list continuation with indentation', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Nested two\nNested three',
        cursorCh: 4,
        cursorLine: 1,
        initialContent: '  - Parent\n  - ',
        mode: 'Text',
        path: 'list-indented-nested.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('  - Parent\n  - Nested two\n  - Nested three');
  });

  it('does not continue list when marker is not immediately followed by space', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Content',
        cursorCh: 1,
        cursorLine: 0,
        initialContent: '-Content',
        mode: 'Text',
        path: 'list-no-space-marker.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    // No valid list marker (no space after -), so no continuation
    expect(result).toBe('-Content');
  });

  it('only applies list marker to lines within the pasted content, not file links', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Text';
        plugin.settings.continueListItems = true;

        const file = await lib.createNote({ content: '- Item:\n- ', path: 'list-with-file.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 2, line: 1 });

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'Attachment description');
        
        const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const pngBytes = atob(pngBase64);
        const bytes = new Uint8Array(pngBytes.length);
        for (let i = 0; i < pngBytes.length; i++) {
          bytes[i] = pngBytes.charCodeAt(i);
        }
        const imgFile = new File([bytes], 'test.png', { type: 'image/png' });
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

    // Text should have list marker, file link should follow
    expect(result).toMatch(/- Attachment description\n- !\[\[Pasted image/);
  });

  it('handles pasting into nested list context', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Sub-item two',
        cursorCh: 6,
        cursorLine: 2,
        initialContent: '1. Main\n   - Sub-item one\n   - ',
        mode: 'Text',
        path: 'list-nested-complex.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    // Should preserve nested structure
    expect(result).toMatch(/1\. Main/);
    expect(result).toMatch(/- Sub-item two/);
  });
});
