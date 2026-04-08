import Fastify, { FastifyInstance } from 'fastify';
import { authPlugin } from '../auth.js';

describe('authPlugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(authPlugin);

    // Add a test route to verify authentication
    fastify.get('/test', async (request) => {
      return { user: request.user };
    });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should register the plugin successfully', async () => {
    expect(fastify.hasDecorator('jwt')).toBe(true);
  });

  it('should accept valid JWT tokens', async () => {
    const token = fastify.jwt.sign({ userId: 1, email: 'test@example.com' });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        dmspt: token
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toHaveProperty('userId', 1);
    expect(body.user).toHaveProperty('email', 'test@example.com');
  });

  it('should NOT reject requests without JWT tokens', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).not.toBeUndefined();
  });

  it('should reject invalid JWT tokens', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        dmspt: 'invalid.token.here'
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error', 'Unauthorized');
  });

  // TODO: Fix this once we implement authentication. An expired JWT token should
  //       not be accepted.
  it.skip('should ignore expired JWT tokens', async () => {
    const token = fastify.jwt.sign(
      { userId: 1, email: 'test@example.com' },
      { expiresIn: '0s' } // Token expires immediately
    );

    // Wait a bit to ensure token is expired
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        dmspt: token
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.user).toBeUndefined();
  });

  it('should set decoded JWT payload on request.user', async () => {
    const payload = {
      userId: 123,
      email: 'user@example.com',
      role: 'admin'
    };
    const token = fastify.jwt.sign(payload);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        dmspt: token
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toHaveProperty('userId', 123);
    expect(body.user).toHaveProperty('email', 'user@example.com');
    expect(body.user).toHaveProperty('role', 'admin');
  });
});
