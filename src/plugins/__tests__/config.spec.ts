import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import configPlugin from '../config.js';
import { loadFullConfigurationOptions } from "../../configuration.js";

describe('configPlugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(configPlugin);
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should decorate fastify instance with config property', () => {
    expect(fastify).toHaveProperty('dmptoolConfig');
    expect(fastify.hasDecorator('dmptoolConfig')).toBe(true);
  });

  it('should add configurationOptions to the fastify instance', async () => {
    const opts = await loadFullConfigurationOptions(fastify);
    expect(fastify.dmptoolConfig).toEqual({
      ...opts,
    });
  });
});
