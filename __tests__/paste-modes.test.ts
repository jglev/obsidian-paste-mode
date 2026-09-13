import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('paste modes', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('Text mode pastes plain text as-is', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Hello\nWorld',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'paste-mode-text.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('Hello\nWorld');
  });

  it('Text (Blockquote) mode wraps pasted lines with the blockquote prefix', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Hello\nWorld',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'paste-mode-text-blockquote.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('> Hello\n> World');
  });

  it('Markdown mode converts pasted HTML to Markdown', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardHtml: '<strong>Hello</strong>',
        clipboardText: 'Hello',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'paste-mode-markdown.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('**Hello**');
  });

  it('Markdown (Blockquote) mode converts HTML then wraps it in a blockquote', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardHtml: '<strong>Hello</strong>',
        clipboardText: 'Hello',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown (Blockquote)',
        path: 'paste-mode-markdown-blockquote.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('> **Hello**');
  });

  it('Code Block mode wraps pasted text in a fenced code block', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: "console.log('hi')",
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Code Block',
        path: 'paste-mode-code-block.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe("```\nconsole.log('hi')\n```");
  });

  it('Code Block (Blockquote) mode fences then blockquotes the pasted text', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: "console.log('hi')",
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Code Block (Blockquote)',
        path: 'paste-mode-code-block-blockquote.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe("> ```\n> console.log('hi')\n> ```");
  });

  it('Passthrough mode does not intercept the paste event at all', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Hello\nWorld',
        cursorCh: 4,
        cursorLine: 0,
        expectContentChange: false,
        initialContent: '    ',
        mode: 'Passthrough',
        path: 'paste-mode-passthrough.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // In Passthrough mode the plugin returns immediately without handling
    // the paste, so triggering the event directly (with no real editor
    // paste listener behind it in this harness) leaves content unchanged.
    expect(result).toBe('    ');
  });
});
