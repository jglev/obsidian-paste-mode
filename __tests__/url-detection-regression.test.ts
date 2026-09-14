import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

import { pasteAndGetResult } from './helpers/e2e-paste';

describe('isURL false-positive regression (opaque "word: text" strings)', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('pastes a single "Label: <value>" line instead of being treated as a URL', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'From: <example@example.com>',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text',
        path: 'label-colon-value-single-line.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('From: <example@example.com>');
  });

  it('pastes multi-line pasted email header text in Text (Blockquote) mode', async () => {
    const emailText = [
      'From: Example <example@example.com>',
      'Sent: Monday, 14 September 2026 15:58:20',
      'To: Example <example@example.com>',
      'Subject: Re: Example',
      ' ',
      'Lorem Ipsum,',
      '',
      'Dolor sit amet consequetor',
    ].join('\n');

    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: emailText,
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Text (Blockquote)',
        path: 'email-header-blockquote.md',
        pluginId,
      },
      vaultPath: vault.path,
    });

    expect(result).toContain('> From: Example <example@example.com>');
    expect(result).toContain('> Dolor sit amet consequetor');
  });

  it('still lets plain (whitespace-free) URLs pass through untouched', async () => {
    const result = await evalInObsidian({
      callback: pasteAndGetResult,
      input: {
        clipboardText: 'https://example.com',
        cursorCh: 0,
        cursorLine: 0,
        initialContent: '',
        mode: 'Markdown',
        path: 'plain-url-still-passthrough.md',
        pluginId,
        expectContentChange: false,
      },
      vaultPath: vault.path,
    });

    expect(result).toBe('');
  });
});
