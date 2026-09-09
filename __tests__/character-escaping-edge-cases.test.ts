import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('character escaping edge cases', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('does not escape characters inside wikilinks', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'text < [[link < with special chars]] more',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-skip-wikilink.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // The < inside the wikilink should not be escaped
    expect(result).toMatch(/\[\[link < with special chars\]\]/);
    // The first < should be escaped (before the link)
    expect(result).toMatch(/text \\</);
  });

  it('does not escape characters inside image embeds', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'image ![[embed < with special]] text',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-skip-image-embed.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // The < inside the image embed should not be escaped
    expect(result).toMatch(/!\[\[embed < with special\]\]/);
    // But the text after should be treated as outside the embed
    expect(result).toContain('> image ![[embed < with special]] text');
  });

  it('escapes characters outside of links and embeds', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'a < b [[c < d]] e < f',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-mixed-context.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // Escape the first < but not inside link, then escape the last <
    const lines = result.split('\n');
    expect(lines[0]).toMatch(/a \\< b \[\[c < d\]\] e \\</);
  });

  it('does not double-escape when backslash already precedes character', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'already \\< escaped',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-no-double.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // Should not add another backslash if already present
    expect(result).toBe('> already \\< escaped');
  });

  it('escapes non-blockquote characters outside of links in normal text mode', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'text [link [ with bracket] more',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'escape-non-blockquote-link.md',
        pluginId,
        settings: { escapeCharactersInNonBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // Note: Wikilinks are [[...]] format, not [...] - so [link...] is NOT a wikilink
    // Therefore both [ characters outside the text will be escaped
    expect(result).toMatch(/text \\\[/);
  });

  it('handles nested and adjacent links/embeds correctly', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '[[link<one]][[link<two]] text < outside',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-adjacent-links.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // < inside both links should not be escaped
    expect(result).toMatch(/\[\[link<one\]\]\[\[link<two\]\]/);
    // < outside should be escaped
    expect(result).toMatch(/text \\</);
  });

  it('handles links at the boundaries of pasted content', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: '[[start < link]] middle < text [[end < link]]',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-boundary-links.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // < inside links should not be escaped
    expect(result).toMatch(/\[\[start < link\]\]/);
    expect(result).toMatch(/\[\[end < link\]\]/);
    // < in middle should be escaped
    expect(result).toMatch(/middle \\\</);
  });

  it('escapes multiple occurrences of the same character outside links', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'a < b < c [[d < e]] f < g',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'escape-multiple.md',
        pluginId,
        settings: { escapeCharactersInBlockquotes: true },
      },
      vaultPath: vault.path,
    });

    // Count escaped < outside links (should be 3: a <, b <, f <)
    const escaped = (result.match(/\\\</g) || []).length;
    expect(escaped).toBe(3);
    // Wikilink should still have unescaped <
    expect(result).toMatch(/\[\[d < e\]\]/);
  });
});
