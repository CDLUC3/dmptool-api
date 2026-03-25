import Fastify, { FastifyInstance } from 'fastify';
import { authPlugin } from './plugins/auth.js';
import { routesPlugin } from './plugins/routes.js';

const port: number = Number(process.env.APP_PORT) || 4060;

if (port) {
  // Initialize the Fastify instance
  const fastify: FastifyInstance = Fastify({ logger: true });

  // TODO: Implement caching, rate limiting, static, swagger documentation, etc.
  //       using fastify plugins

  // Register plugins
  await fastify.register(authPlugin);
  await fastify.register(routesPlugin, { prefix: '/api/v3' });

  // Verify that all plugins have been registered before starting the server,
  // to ensure that all hooks have finished their execution
  fastify.ready(err => {
    if (err) {
      console.log(err)
    }
  });

  // Start the server
  fastify.listen({ port }, function (err: Error | null): void {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
    // Server is now listening on ${address}
  });
} else {
  console.error('APP_PORT is not defined!');
}
