import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import configPlugin from '../config.js';
import graphQLPlugin from '../graphQL.js';

describe('graphQLPlugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
	  fastify = Fastify();
	  await fastify.register(configPlugin);
	  await fastify.register(graphQLPlugin);

    fastify.get('/graphql-client-check', async (request) => {
      return {
      hasClient: Boolean(request.graphQLClient),
      sameClientInstance: request.graphQLClient === request.graphQLClient,
      };
    });
  });

  afterEach(async () => {
	  await fastify.close();
  });

  it('should register the plugin and decorate the request', () => {
	  expect(fastify.hasRequestDecorator('graphQLClient')).toBe(true);
  });

  it('should expose the Apollo client on the request object', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/graphql-client-check',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      hasClient: true,
      sameClientInstance: true,
    });
  });

  it('should log plugin registration on ready', async () => {
    const infoSpy = jest.spyOn(fastify.log, 'info');

    await fastify.ready();

    expect(infoSpy).toHaveBeenCalledWith('GraphQL Plugin has been registered.');
    infoSpy.mockRestore();
  });

  it('should throw when the graphQL uri is missing', async () => {
    const localFastify = Fastify();

    localFastify.decorate('dmptoolConfig', {
      graphQL: {},
    } as FastifyInstance['dmptoolConfig']);

    await expect(localFastify.register(graphQLPlugin))
      .rejects
      .toThrow('Missing graphQL uri');

    await localFastify.close();
  });
});

