import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('character escaping', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('escapes blockquote-special characters when escapeCharactersInBlockquotes is enabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'a < b',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-blockquote.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('> a \\< b');
  });

  it('does not escape characters in blockquotes when escapeCharactersInBlockquotes is disabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'a < b',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-blockquote-disabled.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: false },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('> a < b');
  });

  it('escapes non-blockquote-special characters when escapeCharactersInNonBlockquotes is enabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Hello [World]',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'escape-non-blockquote.md',
        pluginId,
        settings: { escapeCharactersInNonBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('Hello \\[World]');
  });

  it('does not escape characters when escapeCharactersInNonBlockquotes is disabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Hello [World]',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'escape-non-blockquote-disabled.md',
        pluginId,
        settings: { escapeCharactersInNonBlockquotes: false },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('Hello [World]');
  });
});
