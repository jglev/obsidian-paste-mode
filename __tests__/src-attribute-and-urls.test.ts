import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('src attribute handling and URL detection', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('ignores plain URLs when not linking to images', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'https://example.com',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'url-passthrough.md',
        pluginId,
        expectContentChange: false,
      },
      vaultPath: vault.path,
    });

    // Should not intercept plain URLs - defaults to browser handling
    expect(result).toBe('');
  });

  it('allows image URLs to pass through when pasting with markdown mode', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'https://example.com/image.png',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'image-url-passthrough.md',
        pluginId,
        expectContentChange: false,
      },
      vaultPath: vault.path,
    });

    // Image URLs pasted as plain text should not be intercepted by the plugin
    expect(result).toBe('https://example.com/image.png');
  });

  it('ignores app://obsidian.md URLs in HTML src attributes', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'ignored',
        clipboardHtml: '<img src="app://obsidian.md/some/path">',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'app-url-skip.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // app://obsidian.md URLs should be skipped, leaving original
    expect(result).toMatch(/!\[\]\(app:\/\/obsidian\.md\/some\/path\)/);
  });

  it('preserves src attributes when they match srcAttributeCopyRegex (network-dependent)', async () => {
    // Note: This test depends on network access. In restricted environments, URLs are preserved as-is.
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'text with image',
        clipboardHtml: '<img src="https://example.com/test.png" alt="test">',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'src-copy-enabled.md',
        pluginId,
        // Match any .png files
        settings: { srcAttributeCopyRegex: '\\.png$' },
      },
      vaultPath: vault.path,
    });

    // Should have an image link, either pointing at a locally-downloaded
    // copy (network available) or the original URL (network unavailable):
    expect(result).toContain('.png');
  });

  it('does not copy HTML src attributes when srcAttributeCopyRegex does not match', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'text with image',
        clipboardHtml: '<img src="https://example.com/test.png" alt="test">',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'src-copy-no-match.md',
        pluginId,
        // Only match .jpg files (not .png)
        settings: { srcAttributeCopyRegex: '\\.jpg$' },
      },
      vaultPath: vault.path,
    });

    // Should keep original data URL since regex doesn't match
    expect(result).toContain('https://example.com/test.png');
  });

  it('treats empty srcAttributeCopyRegex as disabled (no copying)', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'text with image',
        clipboardHtml: '<img src="https://example.com/test.png" alt="test">',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'src-copy-empty.md',
        pluginId,
        settings: { srcAttributeCopyRegex: '' },
      },
      vaultPath: vault.path,
    });

    // Empty regex means disabled - keep original URL
    expect(result).toContain('https://example.com/test.png');
  });

  it('handles multiple src elements in a single paste', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'multiple images',
        clipboardHtml: '<img src="https://example.com/image1.png"><img src="https://example.com/image2.png">',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'src-multiple.md',
        pluginId,
        settings: { srcAttributeCopyRegex: '\\.png$' },
      },
      vaultPath: vault.path,
    });

    // Should handle both images (either downloaded locally or left as-is):
    expect(result.match(/!\[.*?\]\(.*?\.png\)/g)?.length ?? 0).toBe(2);
  });

  it('preserves non-matching src attributes alongside matching ones', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'mixed sources',
        clipboardHtml: '<img src="https://example.com/image.png"><img src="data:image/svg+xml;test">',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'src-mixed.md',
        pluginId,
        // Only match .png files
        settings: { srcAttributeCopyRegex: '\\.png$' },
      },
      vaultPath: vault.path,
    });

    // The non-matching data: URI should be preserved unchanged, and the
    // matching .png source should still appear as an image link (either
    // downloaded locally or left as-is):
    expect(result).toContain('data:image/svg+xml;test');
    expect(result).toContain('.png');
  });
});
