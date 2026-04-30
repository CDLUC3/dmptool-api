import Fastify, { FastifyInstance } from 'fastify';
import { toErrorMessage } from "@dmptool/utils";
import { baseConfigurationOptions } from './configuration.js';
import { ConfigurationOptions } from "./types.js";
import healthcheckPlugin from './plugins/healthcheck.js';
import authPlugin from './plugins/auth.js';
import configPlugin from "./plugins/config.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import linksetPlugin from "./plugins/linkset.js";

import v3RoutesPlugin from "./plugins/v3/routes.js";

const baseConfig: ConfigurationOptions = baseConfigurationOptions;

const MB_TO_BYTES = 1024 * 1024;

// Initialize the Fastify instance
const fastify: FastifyInstance = Fastify({
  ajv: {
    customOptions: {
      strict: true,
      strictSchema: false, // This allows 'default' inside subschemas
    }
  },
  ignoreTrailingSlash: true, // This allows both `/documentation` and `/documentation/`
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
  bodyLimit: Number(Math.floor(baseConfig.payloadSizeLimit * MB_TO_BYTES))
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
    // Register community plugins
    // TODO: Implement caching, etc. using fastify community plugins
    await fastify.register(rateLimitPlugin, {});

    // Register our global plugins
    await fastify.register(healthcheckPlugin);
    await fastify.register(configPlugin);
    await fastify.register(authPlugin, { logLevel: config.logLevel });
    await fastify.register(linksetPlugin, {});

    // Register our routes
    await fastify.register(v3RoutesPlugin, { prefix: config.pathPrefixes.v3 });

    // If in development mode, print the routes to the console for help debugging
    if (config.nodeEnv === 'development') {
      console.log(fastify.printRoutes());
    }

    // Listen on the specified port
    const address = await fastify.listen({
      host: "0.0.0.0",
      port: config.port
    });

    fastify.log.info(`Server listening on ${address}`);
  } catch (err) {
    fastify.log.error(toErrorMessage(err));

    console.log(err)

    // process.exit(1);
  }
};

await start(baseConfig);
