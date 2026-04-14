import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { rateLimitPlugin } from '../rateLimit.js';

describe('rateLimitPlugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(rateLimitPlugin, {});
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('404 Handler with Rate Limiting', () => {
    it('should return 404 status code for unknown routes', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/some-random-route-that-does-not-exist',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return the custom error payload', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/not-found-path',
      });

      expect(response.json()).toEqual({
        statusCode: '404',
        error: 'Not Found',
      });
    });
  });
});
