import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { gql } from '@apollo/client/core';
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

    expect(infoSpy).toHaveBeenCalledWith(
      { "endpoint": "http://localhost:4000" },
      'GraphQL Plugin has been registered.'
    );
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

describe('graphQLPlugin error handling', () => {
  jest.setTimeout(20000);

  const query = gql`
    query TestQuery {
      __typename
    }
  `;

  const makeBackend = async (
    statusCode: number,
    payload: Record<string, unknown>
  ): Promise<FastifyInstance> => {
    const backend = Fastify();
    backend.post('/graphql', async (_request, reply) => {
      return reply.code(statusCode).send(payload);
    });
    await backend.listen({ port: 0, host: '127.0.0.1' });

    return backend;
  };

  const makePluginHost = async (uri: string): Promise<FastifyInstance> => {
    const app = Fastify();
    app.decorate('dmptoolConfig', {
      graphQL: { uri },
    } as FastifyInstance['dmptoolConfig']);
    await app.register(graphQLPlugin);

    app.post('/run-query', async (request, reply) => {
      try {
        if (!request.graphQLClient) throw new Error('Missing graphQLClient request decorator');
        await request.graphQLClient.query({ query, fetchPolicy: 'no-cache' });
      } catch {
        // Expected in error-path tests.
      }

      return reply.code(200).send({ ok: true });
    });

    await app.ready();
    return app;
  };

  it('logs GraphQL query errors from a 200 response', async () => {
    const backend = await makeBackend(200, {
      errors: [{ message: 'Resolver failed', path: ['ping'], locations: [{ line: 1, column: 1 }] }],
      data: null,
    });
    const address = backend.server.address();
    const uri = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/graphql`;
    const app = await makePluginHost(uri);

    const errorSpy = jest.spyOn(app.log, 'error');
    const response = await app.inject({ method: 'POST', url: '/run-query' });

    expect(response.statusCode).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Resolver failed', path: ['ping'] }),
      '[Apollo GraphQL error]: Resolver failed'
    );

    await app.close();
    await backend.close();
  });

  it('logs warn for protocol 401 errors', async () => {
    const backend = await makeBackend(401, { errors: [{ message: 'Unauthorized' }] });
    const address = backend.server.address();
    const uri = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/graphql`;
    const app = await makePluginHost(uri);

    const warnSpy = jest.spyOn(app.log, 'warn');
    const response = await app.inject({ method: 'POST', url: '/run-query' });

    expect(response.statusCode).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401 }),
      '[Apollo error] Unauthorized: Token likely expired.'
    );

    await app.close();
    await backend.close();
  });

  it('logs fatal for protocol 500 errors', async () => {
    const backend = await makeBackend(500, { errors: [{ message: 'Server failure' }] });
    const address = backend.server.address();
    const uri = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/graphql`;
    const app = await makePluginHost(uri);

    const fatalSpy = jest.spyOn(app.log, 'fatal');
    const response = await app.inject({ method: 'POST', url: '/run-query' });

    expect(response.statusCode).toBe(200);
    expect(fatalSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 }),
      '[Apollo error] Apollo Server Critical Failure.'
    );

    await app.close();
    await backend.close();
  });

  it('logs network errors without a status code', async () => {
    const app = await makePluginHost('http://127.0.0.1:1/graphql');

    const errorSpy = jest.spyOn(app.log, 'error');
    const response = await app.inject({ method: 'POST', url: '/run-query' });

    expect(response.statusCode).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: expect.any(Object),
      }),
      '[Apollo Network Error] - No status code available'
    );

    await app.close();
  });
});

