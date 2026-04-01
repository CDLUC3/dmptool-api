import Fastify, { FastifyInstance } from 'fastify';
import { authPlugin } from './plugins/auth.js';
import { routesPlugin } from './plugins/routes.js';
import { toErrorMessage } from "@dmptool/utils";

const port: number = Number(process.env.APP_PORT) || 4060;

// Initialize the Fastify instance
const fastify: FastifyInstance = Fastify({ logger: true });

const start = async (): Promise<void> => {
  try {
    // TODO: Implement caching, rate limiting, static, swagger documentation, etc.
    //       using fastify plugins

    // Register plugins
    await fastify.register(authPlugin);
    await fastify.register(routesPlugin, { prefix: '/api/v3' });

    // Listen on the specified port
    const address = await fastify.listen({ port });

    fastify.log.info(`Server listening on ${address}`);
  } catch (err) {
    fastify.log.error(toErrorMessage(err));
    process.exit(1);
  }
};

await start();
