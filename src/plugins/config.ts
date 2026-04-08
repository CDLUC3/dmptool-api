import fp from 'fastify-plugin';
import {
  configurationOptions,
  ConfigurationOptionsType
} from '../configuration.js';

/**
 * Plugin that adds the configuration options to the fastify instance
 */
export const configPlugin = fp(async function (fastify): Promise<void> {
  // Use decorate so it's accessible via fastify.config
  fastify.decorate(
    'dmptoolConfig',
    { getter: (): ConfigurationOptionsType => configurationOptions }
  );

  // Access via the request object `request.config`
  fastify.decorateRequest(
    'dmptoolConfig',
    { getter: (): ConfigurationOptionsType => configurationOptions }
  );
});
