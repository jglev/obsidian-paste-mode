import { describe, expect, it } from '@jest/globals';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/jest-global-setup-plugin';

describe('obsidian-paste-to-current-indentation', () => {
  const vault = getTemporaryVault();
  const pluginId = 'obsidian-paste-to-current-indentation';

  it('should be enabled', async () => {
    const isEnabled = await evalInObsidian({
      input: { pluginId },
      callback: ({ app, pluginId }) => (app as any).plugins.enabledPlugins.has(pluginId),
      vaultPath: vault.path
    });
    expect(isEnabled).toBe(true);
  });

  it('should create a file', async () => {
    await evalInObsidian({
      callback: async ({ app }) => {
        await app.vault.create('test.md', '# Test File\nThis is a test.');
      },
      vaultPath: vault.path
    });

    const content = await evalInObsidian({
      callback: ({ app }) => app.vault.adapter.read('test.md'),
      vaultPath: vault.path
    });

    expect(content).toBe('# Test File\nThis is a test.');
  });
});
