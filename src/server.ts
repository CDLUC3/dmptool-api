import Fastify, { FastifyInstance } from 'fastify';
import { authPlugin } from './plugins/auth.js';
import { routesPlugin } from './plugins/routes.js';
import { toErrorMessage } from "@dmptool/utils";
import { configurationOptions } from './configuration.js';
import { configPlugin } from "./plugins/config.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { linksetPlugin } from "./plugins/linkset.js";
import { serializationPlugin } from "./plugins/serialization.js";
import { errorPlugin } from "./plugins/error.js";

// Initialize the Fastify instance
const fastify: FastifyInstance = Fastify({
  ajv: {
    customOptions: {
      strict: true,
      strictSchema: false, // This allows 'default' inside subschemas
    }
  },
  logger: true
});

/**
 * Start the Fastify server
 *
 * @param config The configuration options
 */
const start = async (
  config: typeof configurationOptions
): Promise<void> => {
  try {
    // Swagger is a community plugin, but it needs to be registered after our error handlers
    if (configurationOptions.deploymentEnv !== 'prd') {
      await fastify.register(swaggerPlugin, {});
    }

    // Register community plugins
    // TODO: Implement caching, etc. using fastify community plugins
    await fastify.register(rateLimitPlugin, {});

    // Register our plugins
    await fastify.register(configPlugin);
    await fastify.register(errorPlugin);

    // Register the rest of our plugins
    await fastify.register(serializationPlugin, { logLevel: config.logLevel });
    await fastify.register(authPlugin, { logLevel: config.logLevel });
    await fastify.register(linksetPlugin, {});
    await fastify.register(routesPlugin, {
      logLevel: config.logLevel,
      prefix: config.pathPrefix,
      config
    });

    // Listen on the specified port
    const address = await fastify.listen({ port: config.port });

    fastify.log.info(`Server listening on ${address}`);
  } catch (err) {
    fastify.log.error(toErrorMessage(err));
    process.exit(1);
  }
};

if (configurationOptions.jwtSecret !== undefined) {
  await start(configurationOptions);
} else {
  fastify.log.error('JWT_SECRET is not set');
  process.exit(1);
}
