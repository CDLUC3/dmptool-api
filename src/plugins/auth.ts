import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Plugin that verifies a Bearer JWT with the auth service's JWKS and sets the
 * user property on the request object.
 *
 * Using fastify-plugin to hoist this to the global scope
 *
 * @param {FastifyInstance} fastify Encapsulated Fastify Instance
 */

const authPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {
  const jwks = createRemoteJWKSet(new URL(fastify.dmptoolConfig.authJwksUri));

  fastify.decorateRequest('caller', fastify.dmptoolConfig.authAudience);
  fastify.decorateRequest('authorizationToken', undefined);

  // For every request, verify the JWT token if it exists and then set the user
  // property on the request object. Return an error if the token is invalid.
  fastify.addHook('onRequest', async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const authorization = request.headers.authorization;
      if (!authorization) {
        request.user = {};
        return;
      }

      const match = /^Bearer\s+(.+)$/i.exec(authorization);
      if (!match) throw new Error('Authorization header must use the Bearer scheme');

      const { payload } = await jwtVerify(match[1], jwks, {
        algorithms: ['RS256'],
        issuer: fastify.dmptoolConfig.authIssuer,
        audience: fastify.dmptoolConfig.authAudience,
      });
      request.user = payload;
      request.authorizationToken = authorization;
    } catch (err: unknown) {
      fastify.log.debug({ err }, 'Bearer token verification failed');
      return reply.status(401).send({
        error_code: 'authentication_required',
        message: 'Authorization token verification failed'
      });
    }
  });

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('Auth Plugin has been registered.');
  });
});

export default authPlugin;
