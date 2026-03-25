import type { FastifyInstance } from 'fastify';

/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
export async function routesPlugin (fastify: FastifyInstance): Promise<void> {
  // Simple health check route for the ALB
  fastify.get(
    '/healthcheck',
    async (): Promise<{ msg: string }> => {
      return { msg: 'OK' }
    }
  );

  // TODO: Add routes for each endpoint defined in the OpenAPI schema for the
  //       RDA common API: https://github.com/RDA-DMP-Common/common-madmp-api/tree/setup-rest-crud
  //       Also import and use the routeSchema.ts and serializer.ts files to define
  //       the schemas for the requests and responses for each route
}
