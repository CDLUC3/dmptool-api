import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import authPlugin from '../auth.js';

describe('authPlugin', () => {
  let fastify: FastifyInstance;
  let privateKey: CryptoKey;
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    const publicJwk = await exportJWK(keys.publicKey);
    publicJwk.kid = 'test-key';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';

    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    fastify = Fastify();
    fastify.decorate('dmptoolConfig', {
      applicationName: 'DMP Tool API',
      authJwksUri: 'http://localhost:4646/jwks',
      authIssuer: 'http://localhost:4646',
      authAudience: 'dmptool-api',
    } as FastifyInstance['dmptoolConfig']);
    await fastify.register(authPlugin);
    fastify.get('/test', async (request) => ({ user: request.user }));
  });

  afterEach(async () => {
    await fastify.close();
    fetchSpy.mockRestore();
  });

  const makeToken = async (audience = 'dmptool-api'): Promise<string> =>
    new SignJWT({ userId: 123, email: 'user@example.com', role: 'admin' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('http://localhost:4646')
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  it('registers successfully without accepting cookie authentication', async () => {
    await fastify.ready();
    expect(fastify.hasRequestDecorator('authorizationToken')).toBe(true);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: { token: await makeToken() },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual({});
  });

  it('allows requests without an Authorization header', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual({});
  });

  it('verifies a Bearer token with the JWKS and exposes its payload', async () => {
    const token = await makeToken();
    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({ userId: 123, email: 'user@example.com', role: 'admin' });
  });

  it('rejects invalid tokens and audience mismatches', async () => {
    const invalid = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    expect(invalid.statusCode).toBe(401);

    const wrongAudience = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: `Bearer ${await makeToken('other-api')}` },
    });
    expect(wrongAudience.statusCode).toBe(401);
    expect(wrongAudience.json()).toHaveProperty('error_code', 'authentication_required');

    const expiredToken = await new SignJWT({ userId: 123 })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('http://localhost:4646')
      .setAudience('dmptool-api')
      .setIssuedAt()
      .setExpirationTime('-1m')
      .sign(privateKey);
    const expired = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    expect(expired.statusCode).toBe(401);
  });

  it('rejects non-Bearer Authorization values', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: 'Basic abc' },
    });
    expect(response.statusCode).toBe(401);
  });
});
