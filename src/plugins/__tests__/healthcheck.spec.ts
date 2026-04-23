import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import healthcheckPlugin from "../healthcheck.js";

describe('GET /healthcheck', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({
      ajv: {
        customOptions: {
          strict: true,
          // Allows the `default` keyword in our Zod schemas
          strictSchema: false,
        }
      }
    });
    // Register the config and headers plugins first as the routes are dependent on them
    await fastify.register(healthcheckPlugin);
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should return 200 status code', async () => {
    const response  = await fastify.inject({
      method: 'GET',
      url: '/api-healthcheck',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'OK', status_code: '200' });
  });
});
