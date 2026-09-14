// Jest setup for obsidian-integration-testing
// Configure the transport before tests run
export { };

declare global {
  // eslint-disable-next-line no-var -- `var` is required (instead of `let`/`const`) to augment the global scope in a `declare global` block
  var __obsidianIntegrationTesting: {
    transportOptions?: { type: string };
    temporaryVaultPath?: string;
  } | undefined;
}

globalThis.__obsidianIntegrationTesting = {
  ...globalThis.__obsidianIntegrationTesting,
  transportOptions: { type: 'obsidian-cdp' }
};
