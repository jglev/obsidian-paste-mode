import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('paste indentation handling', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('reindents pasted continuation lines to match the cursor indentation', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '  Hello\n  World',
        cursorCh: 4,
        cursorLine: 0,
        initialContent: '    ',
        mode: 'Text',
        path: 'indentation-reindent.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('    Hello\n    World');
  });

  it('continues a bullet list when continueListItems is enabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item two\nItem three',
        cursorCh: 2,
        cursorLine: 1,
        initialContent: '- Item one\n- ',
        mode: 'Text',
        path: 'indentation-bullet-list.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('- Item one\n- Item two\n- Item three');
  });

  it('increments numbered list markers when continueListItems is enabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item two\nItem three',
        cursorCh: 3,
        cursorLine: 1,
        initialContent: '1. Item one\n1. ',
        mode: 'Text',
        path: 'indentation-numbered-list.md',
        pluginId,
        settings: { continueListItems: true },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('1. Item one\n2. Item two\n3. Item three');
  });

  it('does not add list markers when continueListItems is disabled', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'Item two\nItem three',
        cursorCh: 2,
        cursorLine: 1,
        initialContent: '- Item one\n- ',
        mode: 'Text',
        path: 'indentation-bullet-list-disabled.md',
        pluginId,
        settings: { continueListItems: false },
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('- Item one\n- Item two\n  Item three');
  });
});
