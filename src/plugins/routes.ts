import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
export async function routesPlugin (fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/healthcheck',
    async (request: FastifyRequest): Promise<{ msg: string }> => {

      console.log('USER:', request.user);

      return { msg: 'OK' }
    }
  );
}
