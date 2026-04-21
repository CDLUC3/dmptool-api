import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { toErrorMessage } from "@dmptool/utils";
import { baseConfigurationOptions } from './configuration.js';
import authPlugin from './plugins/auth.js';
import configPlugin from "./plugins/config.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import linksetPlugin from "./plugins/linkset.js";

import { ConfigurationOptions } from "./types.js";
import v3 from "./versions/v3.js";

const baseConfig: ConfigurationOptions = baseConfigurationOptions;

const envToLogger = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
}

// Initialize the Fastify instance
const fastify: FastifyInstance = Fastify({
  ajv: {
    customOptions: {
      strict: true,
      strictSchema: false, // This allows 'default' inside subschemas
    }
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    // Mask any log entries that might contain sensitive info
    redact: [
      'req.headers.authorization',
      'req.headers.cookies',
      'password',
      'pwd',
      'token',
      'secret',
      'jwtSecret',
      'cookie',
      'cookieConfig',
      'jwtCookieName'
    ],
  },
  // Convert the specified size in MB to MiB
  bodyLimit: Number(Math.floor(baseConfig.payloadSizeLimit * 0.953674))
});

/**
 * Start the Fastify server
 *
 * @param {ConfigurationOptions} config Configuration options
 */
const start = async (
  config: ConfigurationOptions
): Promise<void> => {
  try {
    /**
     * Load balancer health check endpoint
     */
    fastify.get(
      '/api-healthcheck',
      async (_request: FastifyRequest, reply: FastifyReply
      ): Promise<void> => {
        reply.code(200).send({ status_code: '200', message: 'OK' });
      }
    );

    // Register community plugins
    // TODO: Implement caching, etc. using fastify community plugins
    await fastify.register(rateLimitPlugin, {});

    // Register our global plugins
    await fastify.register(configPlugin);
    await fastify.register(authPlugin, { logLevel: config.logLevel });
    await fastify.register(linksetPlugin, {});

    // Register our versions
    await fastify.register(v3, { prefix: config.pathPrefixes.v3 });

    await fastify.ready();

    // If in development mode, print the routes to the console
    if (config.nodeEnv === 'development') {
      console.log(fastify.printRoutes());
    }

    await fastify.ready();

    // Listen on the specified port
    const address = await fastify.listen({
      host: "0.0.0.0",
      port: config.port
    });

    fastify.log.info(`Server listening on ${address}`);
  } catch (err) {
    fastify.log.error(toErrorMessage(err));
    process.exit(1);
  }
};

await start(baseConfig);
