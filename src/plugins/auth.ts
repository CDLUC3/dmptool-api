import fp from 'fastify-plugin';
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import dotenv from 'dotenv';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_COOKIE_NAME = 'dmspt';

/**
 * Plugin that decodes the JWT token if present and sets the user property on
 * the request object
 *
 * @param {FastifyInstance} fastify Encapsulated Fastify Instance
 */

export const authPlugin = fp(async function (fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
    cookie: {
      cookieName: JWT_COOKIE_NAME,
      signed: false,

    }
  });

  // For every request, verify the JWT token if it exists and then set the user
  // property on the request object. Return an error if the token is invalid.
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await request.jwtVerify();
    } catch (error) {
      const fastifyError = error as FastifyError;

      // If no token was provided, silently set the user to an empty object
      if (fastifyError.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE') {
        request.user = {};
      } else {
        if (process.env.NODE_ENV !== 'test') {
          console.log('Optional JWT verification failed:', error);
        }

        return reply.status(401).send({
          error: 'Unauthorized',
          message: fastifyError.message || 'Authorization token verification failed'
        });
      }

    }
  });
});
