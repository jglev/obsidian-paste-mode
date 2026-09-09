import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

describe('commands', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('cycle-paste-mode command advances to the next mode', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        await plugin.loadSettings();
        plugin.settings.mode = 'Text';

        (app as any).commands.executeCommandById(`${pluginId}:cycle-paste-mode`);

        return plugin.settings.mode;
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    expect(result).toBe('Text (Blockquote)');
  });

  it('set-paste-mode-CodeBlock command sets the mode directly', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        await plugin.loadSettings();
        plugin.settings.mode = 'Text';

        (app as any).commands.executeCommandById(`${pluginId}:set-paste-mode-CodeBlock`);

        return plugin.settings.mode;
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    expect(result).toBe('Code Block');
  });

  it('toggle-blockquote-at-current-indentation command adds and then removes a blockquote prefix', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, obsidianModule, lib, pluginId }: any) => {
        const plugin = app.plugins.plugins[pluginId];
        await plugin.loadSettings();

        const file = await lib.createNote({ content: 'Hello World', path: 'toggle-blockquote.md' });
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);

        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        const editor = view.editor;
        editor.focus();
        editor.setCursor({ ch: 0, line: 0 });

        (app as any).commands.executeCommandById(`${pluginId}:toggle-blockquote-at-current-indentation`);
        const afterFirstToggle = editor.getValue();

        (app as any).commands.executeCommandById(`${pluginId}:toggle-blockquote-at-current-indentation`);
        const afterSecondToggle = editor.getValue();

        return { afterFirstToggle, afterSecondToggle };
      },
      input: { pluginId },
      vaultPath: vault.path,
    });

    expect(result.afterFirstToggle).toBe('> Hello World');
    expect(result.afterSecondToggle).toBe('Hello World');
  });
});
