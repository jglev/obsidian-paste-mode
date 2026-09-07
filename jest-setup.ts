// Jest setup for obsidian-integration-testing
// Configure the transport before tests run
export { };

declare global {
  // eslint-disable-next-line no-var
  var __obsidianIntegrationTesting: {
    transportOptions?: { type: string };
    temporaryVaultPath?: string;
  } | undefined;
}

console.log('DEBUG before:', JSON.stringify(globalThis.__obsidianIntegrationTesting));

globalThis.__obsidianIntegrationTesting = {
  ...globalThis.__obsidianIntegrationTesting,
  transportOptions: { type: 'obsidian-cdp' }
};

console.log('DEBUG after:', JSON.stringify(globalThis.__obsidianIntegrationTesting));
