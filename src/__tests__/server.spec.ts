import { describe, expect, it, jest } from '@jest/globals';

const mockRegister = jest.fn().mockImplementation(() => Promise.resolve());

// Mock the fastify factory
jest.unstable_mockModule('fastify', () => ({
  default: () => ({
    register: mockRegister,
    listen: jest.fn(),
    log: { info: jest.fn(), error: jest.fn() },
    addHook: jest.fn(),
    decorate: jest.fn(),
    decorateRequest: jest.fn(),
  }),
}));

// Mock the actual plugins so we can identify them in the call stack
jest.unstable_mockModule('../plugins/swagger.js', () => ({ swaggerPlugin: jest.fn().mockName('swaggerPlugin') }));
jest.unstable_mockModule('../plugins/rateLimit.js', () => ({ rateLimitPlugin: jest.fn().mockName('rateLimitPlugin') }));
jest.unstable_mockModule('../plugins/config.js', () => ({ configPlugin: jest.fn().mockName('configPlugin') }));
jest.unstable_mockModule('../plugins/error.js', () => ({ errorPlugin: jest.fn().mockName('errorPlugin') }));
jest.unstable_mockModule('../plugins/auth.js', () => ({ authPlugin: jest.fn().mockName('authPlugin') }));
jest.unstable_mockModule('../plugins/serialization.js', () => ({ serializationPlugin: jest.fn().mockName('serializationPlugin') }));
jest.unstable_mockModule('../plugins/linkset.js', () => ({ linksetPlugin: jest.fn().mockName('linksetPlugin') }));
jest.unstable_mockModule('../plugins/routes.js', () => ({ routesPlugin: jest.fn().mockName('routesPlugin') }));

describe('Server Registration Order', () => {
  it('should register plugins in the correct dependency order', async () => {
    // Import the server to trigger the top-level 'await start()'
    await import('../server.js');

    // Extract the first argument of every register call
    const registeredPlugins = mockRegister.mock.calls.map(call => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugin = call[0] as any;
      return plugin.getMockName ? plugin.getMockName() : 'unknown';
    });

    // Check for specific registration sequences
    const swaggerIndex = registeredPlugins.indexOf('swaggerPlugin');
    const rateLimitIndex = registeredPlugins.indexOf('rateLimitPlugin');
    const configIndex = registeredPlugins.indexOf('configPlugin');
    const errorIndex = registeredPlugins.indexOf('errorPlugin');
    const authIndex = registeredPlugins.indexOf('authPlugin');
    const serializationIndex = registeredPlugins.indexOf('serializationPlugin');
    const linksetIndex = registeredPlugins.indexOf('linksetPlugin');
    const routesIndex = registeredPlugins.indexOf('routesPlugin');

    // 3rd party plugins are registered first
    expect(swaggerIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeGreaterThan(-1);

    // Config and Error plugins should be registered after 3rd party plugins
    expect(configIndex).toBeGreaterThan(swaggerIndex);
    expect(errorIndex).toBeGreaterThan(swaggerIndex);
    expect(configIndex).toBeGreaterThan(rateLimitIndex);
    expect(errorIndex).toBeGreaterThan(rateLimitIndex);

    // Serialization plugin should come before Auth
    expect(serializationIndex).toBeLessThan(authIndex);

    // Config must come before Auth and Routes plugins
    expect(configIndex).toBeLessThan(authIndex);
    expect(configIndex).toBeLessThan(routesIndex);

    // Linkset and Routes must come after Auth
    expect(linksetIndex).toBeGreaterThan(authIndex);
    expect(routesIndex).toBeGreaterThan(authIndex);
  });
});
