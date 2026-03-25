import Fastify, { FastifyInstance } from 'fastify';
import { routesPlugin } from '../routes.js';

describe('routesPlugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(routesPlugin, { prefix: '/api/v3' });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /healthcheck', () => {
    it('should return 200 status code', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v3/healthcheck',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return OK message', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v3/healthcheck',
      });

      expect(response.json()).toEqual({ msg: 'OK' });
    });
  });
});
