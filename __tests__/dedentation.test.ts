import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('dedentation', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('removes common leading whitespace from all pasted lines', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        // 4 spaces of common indentation
        clipboardText: '    Hello\n    World\n    Test',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-common-indent.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('Hello\nWorld\nTest');
  });

  it('removes common leading whitespace while preserving relative indentation', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        // 2 spaces common, but second and third have additional indent
        clipboardText: '  First\n    Second\n    Third',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-relative.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('First\n  Second\n  Third');
  });

  it('does not remove indentation when no common leading whitespace exists', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        // No common indent - first line has none
        clipboardText: 'No indent\n  Some indent\n    More indent',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-no-common.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('No indent\n  Some indent\n    More indent');
  });

  it('preserves blank lines during dedentation', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '  Line one\n\n  Line three',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-blank-lines.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('Line one\n\nLine three');
  });

  it('ignores empty lines when calculating minimum indent', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        // Empty lines should not affect the minimum indent calculation
        clipboardText: '    Line one\n\n    Line three',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-ignore-empty.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('Line one\n\nLine three');
  });

  it('handles pasted content with tabs and spaces', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        // Mixed tabs and spaces
        clipboardText: '\t\tFirst\n\t\tSecond',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-tabs.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('First\nSecond');
  });

  it('handles single-line paste without dedentation', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '    Indented line',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-single-line.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Single line with indent should be dedented
    expect(result).toBe('Indented line');
  });

  it('applies dedentation before then reindents to cursor position', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '    Line one\n    Line two',
        cursorCh: 4,
        cursorLine: 0,
        initialContent: '    ',
        mode: 'Text',
        path: 'dedent-then-reindent.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should remove 4 common spaces from pasted, then add cursor's 4 spaces
    expect(result).toBe('    Line one\n    Line two');
  });

  it('handles dedentation with only whitespace lines', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '    First\n    \n    Third',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'dedent-whitespace-only.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('First\n    \nThird');
  });

  it('works correctly with markdown code blocks', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '  const x = 1;\n  const y = 2;',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Code Block',
        path: 'dedent-code-block.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Dedentation happens before code block wrapping
    expect(result).toBe('```\nconst x = 1;\nconst y = 2;\n```');
  });
});
