import fp from 'fastify-plugin';
import { FastifyInstance } from "fastify";
import { loadFullConfigurationOptions } from '../configuration.js';
import { ConfigurationOptions } from '../types.js';

/**
 * Plugin that adds the configuration options to the fastify instance
 *
 * Using fastify-plugin to hoist this to the global scope
 */
const configPlugin = fp(async function (fastify: FastifyInstance): Promise<void> {
  // Load the configuration options
  const fullConfig: ConfigurationOptions = await loadFullConfigurationOptions(fastify);

  // Use decorate so it's accessible via fastify.config
  fastify.decorate(
    'dmptoolConfig',
    { getter: (): ConfigurationOptions => fullConfig }
  );

  // Access via the request object `request.config`
  fastify.decorateRequest(
    'dmptoolConfig',
    { getter: (): ConfigurationOptions => fullConfig }
  );

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('Config Plugin has been registered.');
  });
});

export default configPlugin;
