import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

// Mock the plugins before importing server
jest.mock('../plugins/auth', () => ({
  authPlugin: jest.fn()
}));

jest.mock('../plugins/routes', () => ({
  routesPlugin: jest.fn()
}));

// Mock Fastify
const mockListen = jest.fn();
const mockReady = jest.fn();
const mockRegister = jest.fn();
const mockLogError = jest.fn();

const mockFastify = {
  register: mockRegister,
  ready: mockReady,
  listen: mockListen,
  log: {
    error: mockLogError
  }
} as unknown as FastifyInstance;

jest.mock('fastify', () => {
  return jest.fn(() => mockFastify);
});

describe('Server', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
    jest.resetModules();
  });

  it.only('should initialize server with default port when APP_PORT is not set', async () => {
    delete process.env.APP_PORT;

    await import('../server.js');

    expect(mockListen).toHaveBeenCalledWith({ port: 4060 });
  });

  it('should initialize server with custom port when APP_PORT is set', async () => {
    process.env.APP_PORT = '8080';

    await import('../server.js');

    expect(mockListen).toHaveBeenCalledWith({port: 8080});
  });

  it('should register authPlugin', async () => {
    process.env.APP_PORT = '4060';

    const { authPlugin } = await import('../plugins/auth.js');
    await import('../server.js');

    expect(mockRegister).toHaveBeenCalledWith(authPlugin);
  });

  it('should register routesPlugin with /api/v3 prefix', async () => {
    process.env.APP_PORT = '4060';

    const { routesPlugin } = await import('../plugins/routes.js');
    await import('../server.js');

    expect(mockRegister).toHaveBeenCalledWith(routesPlugin, { prefix: '/api/v3' });
  });

  it('should log error and call fastify.log when plugin registration fails', async () => {
    process.env.APP_PORT = '4060';
    const testError = new Error('Plugin registration failed');
    mockReady.mockImplementation(() => { throw testError });

    await import('../server.js');

    expect(mockFastify.log).toHaveBeenCalledWith(testError);
  });

  it('should log error and exit when server fails to start', async () => {
    process.env.APP_PORT = '4060';
    const testError = new Error('Server start failed');
    mockListen.mockImplementation(() => { throw testError });

    await import('../server.js');

    expect(mockLogError).toHaveBeenCalledWith(testError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should log error to fastify.log when APP_PORT is not a valid number', async () => {
    process.env.APP_PORT = '0';

    await import('../server.js');

    expect(mockFastify.log.error).toHaveBeenCalledWith('APP_PORT is not defined!');
    expect(mockListen).not.toHaveBeenCalled();
  });

  it('should verify all plugins are ready before starting server', async () => {
    process.env.APP_PORT = '4060';

    await import('../server.js');

    expect(mockReady).toHaveBeenCalledWith(expect.any(Function));
  });
});
