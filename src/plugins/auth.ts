import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply}  from 'fastify'
import dotenv from 'dotenv';
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const authPlugin = fp(async function (fastify: FastifyInstance): Promise<void> {
  // Register cookie plugin
  await fastify.register(fastifyCookie)

  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
    cookie: {
      cookieName: 'dmspt',
      signed: false
    }
  })

  // Add onRequest hook to verify JWT
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await request.jwtVerify()
      // request.user is automatically set by jwtVerify to the decoded JWT payload
    } catch (err) {
      // Handle verification error (you can customize this behavior)
      reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })
});
