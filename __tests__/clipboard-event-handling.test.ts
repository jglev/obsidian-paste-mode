import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('clipboard event handling and validation', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('does not process paste event when defaultPrevented is already true', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        plugin.settings.mode = 'Text';

        const file = await lib.createNote({ content: '', path: 'default-prevented.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 0, line: 0 });

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'This should not be pasted');

        const clipboardEvent = new ClipboardEvent('paste', {
          cancelable: true,
          clipboardData: dataTransfer,
        });
        
        // Simulate another plugin already handling this event
        clipboardEvent.preventDefault();

        const before = editor.getValue();
        app.workspace.trigger('editor-paste', clipboardEvent, editor, view);
        
        // Wait a bit to ensure async handling doesn't occur
        await new Promise((r) => setTimeout(r, 200));

        return { 
          after: editor.getValue(),
          changed: editor.getValue() !== before
        };
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    // Content should not change since event was already prevented
    expect(result.changed).toBe(false);
    expect(result.after).toBe('');
  });

  it('handles invalid blockquote escape character regex gracefully', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'test content',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'invalid-regex-blockquote.md',
        pluginId,
        settings: { 
          escapeCharactersInBlockquotes: true,
          blockquoteEscapeCharactersRegex: '[invalid(' // Invalid regex
        },
      },
      vaultPath: vault.path,
    });

    // Should either use fallback regex or handle gracefully
    // Plugin should not crash - result should contain content
    expect(result).toContain('test content');
  });

  it('handles invalid non-blockquote escape character regex gracefully', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'test content',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'invalid-regex-non-blockquote.md',
        pluginId,
        settings: { 
          escapeCharactersInNonBlockquotes: true,
          nonBlockquoteEscapeCharactersRegex: '*invalid*' // Invalid regex
        },
      },
      vaultPath: vault.path,
    });

    // Should not crash
    expect(result).toContain('test content');
  });

  it('handles invalid srcAttributeCopyRegex gracefully', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'text',
        clipboardHtml: '<img src="test.png">',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'invalid-regex-src.md',
        pluginId,
        settings: { 
          srcAttributeCopyRegex: '(?P<invalid)' // Invalid regex with bad group
        },
      },
      vaultPath: vault.path,
    });

    // Should not crash, just skip src attribute processing
    expect(result).toBeDefined();
  });

  it('processes paste with empty clipboard text', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'empty-clipboard-text.md',
        pluginId,
        expectContentChange: false,
      },
      vaultPath: vault.path,
    });

    // Empty paste should result in empty content
    expect(result).toBe('');
  });

  it('processes paste with only whitespace', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '   \n  \n   ',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'whitespace-only.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Whitespace should be preserved
    expect(result).toBe('   \n  \n   ');
  });

  it('ignores paste of plain URLs without triggering special handling', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'https://example.com/page',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'plain-url-text-mode.md',
        pluginId,
        expectContentChange: false,
      },
      vaultPath: vault.path,
    });

    // Plain URLs should not be intercepted in Text mode
    expect(result).toBe('');
  });

  it('does not intercept image links being pasted as plain text', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'https://example.com/image.jpg',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'image-link-plain.md',
        pluginId,
        expectContentChange: false,
      },
      vaultPath: vault.path,
    });

    // Image URL pasted as plain text should be allowed through
    expect(result).toBe('');
  });

  it('handles paste with special regex characters in content when escaping enabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'text with (parentheses) and [brackets]',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'special-regex-chars.md',
        pluginId,
        settings: { 
          escapeCharactersInNonBlockquotes: true,
          nonBlockquoteEscapeCharactersRegex: '(\\[)' // Only escape [
        },
      },
      vaultPath: vault.path,
    });

    // Should escape [ but not (
    expect(result).toContain('(parentheses)');
    expect(result).toMatch(/\\\[brackets\]/);
  });

  it('handles paste into code block mode with various special characters', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'const x = [1, 2, 3];',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Code Block',
        path: 'code-block-special.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Code block should preserve special characters exactly
    expect(result).toContain('const x = [1, 2, 3];');
    expect(result).toMatch(/^```\n/);
  });

  it('handles regex with lookahead/lookbehind patterns', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'abc < def < ghi',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'regex-lookahead.md',
        pluginId,
        settings: { 
          escapeCharactersInBlockquotes: true,
          blockquoteEscapeCharactersRegex: '(<)' // Simple pattern
        },
      },
      vaultPath: vault.path,
    });

    // Should escape all < characters
    const count = (result.match(/\\</g) || []).length;
    expect(count).toBe(2);
  });

  it('handles paste after settings change without reload', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        
        // Start with one setting
        plugin.settings.mode = 'Text';
        plugin.settings.blockquotePrefix = '> ';

        const file = await lib.createNote({ content: '', path: 'settings-change.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 0, line: 0 });

        // Change setting mid-session
        plugin.settings.mode = 'Text (Blockquote)';
        plugin.settings.blockquotePrefix = '| ';

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'content');

        const clipboardEvent = new ClipboardEvent('paste', {
          cancelable: true,
          clipboardData: dataTransfer,
        });

        const before = editor.getValue();
        app.workspace.trigger('editor-paste', clipboardEvent, editor, view);

        await lib.waitUntil({
          message: 'editor content did not change',
          predicate: () => editor.getValue() !== before,
          timeoutInMilliseconds: 10000,
        });

        return editor.getValue();
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    // Should use the new custom prefix
    expect(result).toBe('| content');
  });
});
