import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Plugin that registers the rate limit plugin to limit the number of requests
 * per minute.
 *
 * Using fastify-plugin to hoist this to the global scope
 *
 * @param {FastifyInstance} fastify Encapsulated Fastify Instance
 */
const rateLimitPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {
  await fastify.register(import('@fastify/rate-limit'), {
    // TODO: Wait until the @dmptool/utils package is updated to provide a ValKey client
    //       see the docs here: https://github.com/fastify/fastify-rate-limit
    //       and an example here: https://github.com/fastify/fastify-rate-limit/blob/main/example/example.js
    // redis: <DMPTOOL_REDIS_URL>,
    max: 100,
    timeWindow: '1 minute',
    exponentialBackoff: true,
  });

  // Add a 404 handler that uses rate limiting to prevent bots from searching for valid routes
  fastify.setNotFoundHandler({
    preHandler: fastify.rateLimit({
      max: 50,
      timeWindow: 500
    })
  }, function (request: FastifyRequest, reply: FastifyReply): void {
    reply.status(404).send({ statusCode: '404', error: 'Not Found' });
  });

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('Rate Limit Plugin has been registered.');
  });
});

export default rateLimitPlugin;
