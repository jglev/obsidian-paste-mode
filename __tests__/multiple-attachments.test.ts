import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { ONE_PIXEL_PNG_BASE64 } from './helpers/fixtures';
import { pasteFilesAndGetResult } from './helpers/e2e-paste';

describe('multiple file attachments', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('saves multiple pasted image files and creates links for each', async () => {
    const result = await evalInObsidian({
      callback: pasteFilesAndGetResult,
      input: {
        cursorCh: 0,
        cursorLine: 0,
        files: [
          { base64: ONE_PIXEL_PNG_BASE64, name: 'test1.png' },
          { base64: ONE_PIXEL_PNG_BASE64, name: 'test2.png' },
          { base64: ONE_PIXEL_PNG_BASE64, name: 'test3.png' },
        ],
        initialContent: '',
        mode: 'Text',
        path: 'multi-file-paste.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result.linkedPaths.length).toBe(3);
    expect(result.allAttachmentsExist).toBe(true);
  });

  it('preserves order of multiple pasted files', async () => {
    const result = await evalInObsidian({
      callback: pasteFilesAndGetResult,
      input: {
        cursorCh: 0,
        cursorLine: 0,
        files: [
          { base64: ONE_PIXEL_PNG_BASE64, name: 'file0.png' },
          { base64: ONE_PIXEL_PNG_BASE64, name: 'file1.png' },
        ],
        initialContent: '',
        mode: 'Text',
        path: 'multi-file-order.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should have 2 links on separate lines
    const lines = result.content.split('\n');
    expect(lines.filter((l) => l.startsWith('!')).length).toBe(2);
  });

  it('combines text paste and multiple file attachments', async () => {
    const result = await evalInObsidian({
      callback: pasteFilesAndGetResult,
      input: {
        clipboardText: 'Some pasted text',
        cursorCh: 0,
        cursorLine: 0,
        files: [{ base64: ONE_PIXEL_PNG_BASE64, name: 'image.png' }],
        initialContent: '',
        mode: 'Text',
        path: 'mixed-content-paste.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Should have both text and image link
    expect(result.content).toContain('Some pasted text');
    expect(result.content).toMatch(/!\[\[Pasted image/);
  });

  it('applies indentation to file links when cursor is indented', async () => {
    const result = await evalInObsidian({
      callback: pasteFilesAndGetResult,
      input: {
        cursorCh: 4,
        cursorLine: 0,
        files: [
          { base64: ONE_PIXEL_PNG_BASE64, name: 'test0.png' },
          { base64: ONE_PIXEL_PNG_BASE64, name: 'test1.png' },
        ],
        initialContent: '    ',
        mode: 'Text',
        path: 'indented-files.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    // Both file links should be indented
    const lines = result.content.split('\n');
    const imageLines = lines.filter((l) => l.includes('![['));
    expect(imageLines.length).toBe(2);
    imageLines.forEach((line) => {
      expect(line).toMatch(/^    !/);
    });
  });
});

