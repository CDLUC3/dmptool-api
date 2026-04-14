import fp from 'fastify-plugin';
import { configurationOptions } from '../configuration.js';
import { ConfigurationOptions } from '../types.js';

/**
 * Plugin that adds the configuration options to the fastify instance
 */
export const configPlugin = fp(async function (fastify): Promise<void> {
  // Use decorate so it's accessible via fastify.config
  fastify.decorate(
    'dmptoolConfig',
    { getter: (): ConfigurationOptions => configurationOptions }
  );

  // Access via the request object `request.config`
  fastify.decorateRequest(
    'dmptoolConfig',
    { getter: (): ConfigurationOptions => configurationOptions }
  );
});
