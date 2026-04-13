import fp from 'fastify-plugin';
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { toErrorMessage } from '@dmptool/utils';

/**
 * Plugin that decodes the JWT token if present and sets the user property on
 * the request object
 *
 * @param {FastifyInstance} fastify Encapsulated Fastify Instance
 */

export const authPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {
  await fastify.register(fastifyCookie);

  // If a Cookie name was defined set up the config for fastify-jwt
  const cookieConfig = fastify.dmptoolConfig.jwtCookieName
  ? { cookie: { cookieName: fastify.dmptoolConfig.jwtCookieName, signed: false } }
  : { };

  // If a cookie was provided, use it otherwise this will default to the
  // Authorization header.
  await fastify.register(fastifyJwt, {
    secret: fastify.dmptoolConfig.jwtSecret,
    ...cookieConfig,
  });

  // For every request, verify the JWT token if it exists and then set the user
  // property on the request object. Return an error if the token is invalid.
  fastify.addHook('onRequest', async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      await request.jwtVerify();
    } catch (error: Error | unknown) {
      const fastifyError = error as FastifyError;

      // If no token was provided, silently set the user to an empty object
      if ([
        'FST_JWT_NO_AUTHORIZATION_IN_HEADER',
        'FST_JWT_NO_AUTHORIZATION_IN_COOKIE'
      ].includes(fastifyError.code)) {
        request.user = {};
      } else {
        if (process.env.NODE_ENV !== 'test') {
          fastify.log.error(
            `Optional JWT verification failed: ${toErrorMessage(error)}`
          );
        }

        return reply.status(401).send({
          error_code: 'authentication_required',
          message: fastifyError.message || 'Authorization token verification failed'
        });
      }
    }
  });
});
