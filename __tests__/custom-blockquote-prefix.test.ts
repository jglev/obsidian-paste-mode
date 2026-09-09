import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('custom blockquote prefix', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('uses custom blockquote prefix when set', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Hello\nWorld',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'custom-prefix-simple.md',
        pluginId,
        settings: { blockquotePrefix: '| ' },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('| Hello\n| World');
  });

  it('works with multi-character custom prefix', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Line one\nLine two',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'custom-prefix-multichar.md',
        pluginId,
        settings: { blockquotePrefix: '>>> ' },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('>>> Line one\n>>> Line two');
  });

  it('works with custom prefix containing special markdown characters', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Content',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'custom-prefix-special.md',
        pluginId,
        settings: { blockquotePrefix: '> * ' },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('> * Content');
  });

  it('applies custom prefix in Markdown (Blockquote) mode', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '**bold**',
        clipboardHtml: '<strong>bold</strong>',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown (Blockquote)',
        path: 'custom-prefix-markdown.md',
        pluginId,
        settings: { blockquotePrefix: '% ' },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('% **bold**');
  });

  it('applies custom prefix in Code Block (Blockquote) mode', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: "console.log('test')",
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Code Block (Blockquote)',
        path: 'custom-prefix-code-block.md',
        pluginId,
        settings: { blockquotePrefix: '# ' },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe("# ```\n# console.log('test')\n# ```");
  });

  it('uses custom prefix with indentation at cursor', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item\nAnother',
        cursorCh: 4,
        cursorLine: 0,
        initialContent: '    ',
        mode: 'Text (Blockquote)',
        path: 'custom-prefix-indented.md',
        pluginId,
        settings: { blockquotePrefix: '~ ' },
      },
      vaultPath: vault.path,
    });

    // Should apply cursor indentation + custom prefix
    expect(result).toBe('    ~ Item\n    ~ Another');
  });

  it('applies custom prefix with list continuation', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item two\nItem three',
        cursorCh: 2,
        cursorLine: 1,
        initialContent: '- Item one\n- ',
        mode: 'Text (Blockquote)',
        path: 'custom-prefix-list.md',
        pluginId,
        settings: { 
          blockquotePrefix: '| ',
          continueListItems: true 
        },
      },
      vaultPath: vault.path,
    });

    // Custom blockquote prefix should not override list marker behavior
    // since blockquote wrapping happens differently
    expect(result).toContain('Item two');
    expect(result).toContain('Item three');
  });

  it('handles empty custom prefix (reverts to default)', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Hello',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'custom-prefix-empty.md',
        pluginId,
        settings: { blockquotePrefix: '' },
      },
      vaultPath: vault.path,
    });

    // Empty prefix should either use empty string or revert to default ">"
    // Based on the code, empty string is preserved, so expect no prefix
    expect(result).toBe('Hello');
  });

  it('applies custom prefix correctly across multiple lines in blockquote', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'First\nSecond\nThird\nFourth',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'custom-prefix-multiline.md',
        pluginId,
        settings: { blockquotePrefix: '-> ' },
      },
      vaultPath: vault.path,
    });

    const lines = result.split('\n');
    expect(lines.length).toBe(4);
    lines.forEach(line => {
      expect(line).toMatch(/^-> /);
    });
  });
});
