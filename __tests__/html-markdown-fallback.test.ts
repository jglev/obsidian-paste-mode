import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('markdown mode HTML-to-text fallback', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('falls back to Text mode when htmlToMarkdown returns empty string in Markdown mode', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        // HTML that produces no markdown output
        clipboardText: 'fallback text',
        clipboardHtml: '<div></div>', // Empty HTML
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'markdown-fallback-empty-html.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should fall back to plain text from clipboardText
    expect(result).toBe('fallback text');
  });

  it('falls back to TextBlockquote mode when htmlToMarkdown returns empty string in Markdown (Blockquote) mode', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'fallback text',
        clipboardHtml: '<div></div>',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown (Blockquote)',
        path: 'markdown-blockquote-fallback.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should fall back to Text (Blockquote) mode
    expect(result).toBe('> fallback text');
  });

  it('uses html content when available and converts to markdown', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'plain text fallback',
        clipboardHtml: '<p><strong>bold</strong></p>',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'markdown-html-conversion.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should convert HTML to markdown, not use fallback
    expect(result).toMatch(/\*\*bold\*\*/);
  });

  it('handles pasting with HTML but no text content', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '',
        clipboardHtml: '<em>emphasis</em>',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'markdown-html-only.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should convert the HTML to markdown (using underscores or asterisks)
    expect(result).toMatch(/[\*_]emphasis[\*_]/);
  });

  it('applies blockquote wrapping after fallback to Text (Blockquote)', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'line one\nline two',
        clipboardHtml: '<div></div>',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown (Blockquote)',
        path: 'markdown-blockquote-fallback-multiline.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // All lines should be blockquoted
    expect(result).toBe('> line one\n> line two');
  });

  it('applies indentation after HTML fallback', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'content',
        clipboardHtml: '<div></div>',
        cursorCh: 4,
        cursorLine: 0,
        initialContent: '    ',
        mode: 'Markdown',
        path: 'markdown-fallback-indent.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should apply cursor indentation
    expect(result).toBe('    content');
  });
});
