import { describe, expect, it, jest } from '@jest/globals';

const mockRegister = jest.fn().mockImplementation(() => Promise.resolve());

// Mock the fastify factory
jest.unstable_mockModule('fastify', () => ({
  default: () => ({
    register: mockRegister,
    listen: jest.fn(),
    get: jest.fn(),
    log: { info: jest.fn(), error: jest.fn() },
    addHook: jest.fn(),
    decorate: jest.fn(),
    decorateRequest: jest.fn(),
  }),
}));

// Mock the actual plugins so we can identify them in the call stack
jest.unstable_mockModule('../plugins/healthcheck.js', () => ({ default: jest.fn().mockName('healthcheckPlugin') }));
jest.unstable_mockModule('../plugins/config.js', () => ({ default: jest.fn().mockName('configPlugin') }));
jest.unstable_mockModule('../plugins/auth.js', () => ({ default: jest.fn().mockName('authPlugin') }));
jest.unstable_mockModule('../plugins/linkset.js', () => ({ default: jest.fn().mockName('linksetPlugin') }));
jest.unstable_mockModule('../plugins/rateLimit.js', () => ({ default: jest.fn().mockName('rateLimitPlugin') }));
jest.unstable_mockModule('../plugins/graphQL.js', () => ({ default: jest.fn().mockName('graphQLPlugin') }));

jest.unstable_mockModule('../plugins/v3/swagger.js', () => ({ default: jest.fn().mockName('v3SwaggerPlugin') }));
jest.unstable_mockModule('../plugins/v3/outboundSerialization.js', () => ({ default: jest.fn().mockName('v3SerializationPlugin') }));
jest.unstable_mockModule('../plugins/v3/routes.js', () => ({ default: jest.fn().mockName('v3RoutesPlugin') }));

describe('Server Registration Order', () => {
  it('should register plugins in the correct dependency order', async () => {
    // Circuit breaker to catch server startup errors
    //
    // If this occurs, comment out the process.exit() call in ../server.ts and add
    // a debugger statement to see the error
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process.exit was called with code ${code}`);
    });

    // Import the server to trigger the top-level 'await start()'
    await import('../server.js');

    // Extract the first argument of every register call
    const registeredPlugins = mockRegister.mock.calls.map(call => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugin = call[0] as any;
      return plugin.getMockName ? plugin.getMockName() : 'unknown';
    });

    // Check for specific registration sequences
    const rateLimitIndex = registeredPlugins.indexOf('rateLimitPlugin');
    const healthcheckIndex = registeredPlugins.indexOf('healthcheckPlugin');
    const configIndex = registeredPlugins.indexOf('configPlugin');
    const authIndex = registeredPlugins.indexOf('authPlugin');
    const linksetIndex = registeredPlugins.indexOf('linksetPlugin');
    const graphQLIndex = registeredPlugins.indexOf('graphQLPlugin');
    const v3RoutesIndex = registeredPlugins.indexOf('v3RoutesPlugin');

    // 3rd party plugins are registered first
    expect(rateLimitIndex).toBeGreaterThan(-1);

    // Health check should come before Config
    expect(healthcheckIndex).toBeLessThan(configIndex);

    // Config and Error plugins should be registered after 3rd party plugins
    expect(configIndex).toBeGreaterThan(rateLimitIndex);

    // Config must come before Auth and Routes plugins
    expect(configIndex).toBeLessThan(authIndex);
    expect(configIndex).toBeLessThan(v3RoutesIndex);

    // Linkset, GraphQL and Routes must come after Config
    expect(linksetIndex).toBeGreaterThan(configIndex);
    expect(graphQLIndex).toBeGreaterThan(configIndex);
    expect(v3RoutesIndex).toBeGreaterThan(linksetIndex);

    // GraphQL, Rate limit and auth must come before routes
    expect(rateLimitIndex).toBeLessThan(v3RoutesIndex);
    expect(authIndex).toBeLessThan(v3RoutesIndex);
    expect(graphQLIndex).toBeLessThan(v3RoutesIndex);
  });
});
