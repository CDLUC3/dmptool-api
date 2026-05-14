import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { DMP_TOOL_CONTENT_TYPE } from "../routeSchema.js";
import configPlugin from "../../config.js";
import { mockMaDMPModule } from "./maDMPMocks.js";

mockMaDMPModule();

describe('v3 serialization', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({
      ajv: {
        customOptions: {
          strict: true,
          // Allows the `default` keyword in our Zod schemas
          strictSchema: false,
        }
      }
    });

    await fastify.register(configPlugin, {});

    // Must import the routes plugin here because the maDMP functions we need to
    // mock are called in the routes plugin and would override the mocks otherwise
    const v3RoutesPlugin = (await import('../routes.js')).default;
    await fastify.register(v3RoutesPlugin, { prefix: '/api/test' });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should set Content-Type to DMPTool header when Accept header matches', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: DMP_TOOL_CONTENT_TYPE },
    });

    expect(response.headers['content-type']).toBe(`${DMP_TOOL_CONTENT_TYPE}; charset=utf-8`);
  });

  it('should set Content-Type to RDA header when Accept header matches', async () => {
    const rdaHeader = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: rdaHeader },
    });

    expect(response.headers['content-type']).toBe(`${rdaHeader}; charset=utf-8`);
  });

  it('should default to RDA header when Accept is application/json', async () => {
    const rdaHeader = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: 'application/json' },
    });

    expect(response.headers['content-type']).toBe(`${rdaHeader}; charset=utf-8`);
  });

  it('should return a 406 unsupported error when the accept type is not supported', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: 'application/xml' },
    });

    expect(response.statusCode).toBe(406);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('status_code', 406);
    expect(body).toHaveProperty('error_code', 'not_acceptable');
    expect(body).toHaveProperty('message', 'The server does not support any of the requested content types.');
  });

  it('should set Content-Type to DMPTool header when Accept header matches', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: DMP_TOOL_CONTENT_TYPE },
    });

    expect(response.headers['content-type']).toBe(`${DMP_TOOL_CONTENT_TYPE}; charset=utf-8`);
  });

  it('should set Content-Type to RDA header when Accept header matches', async () => {
    const rdaHeader = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: rdaHeader },
    });

    expect(response.headers['content-type']).toBe(`${rdaHeader}; charset=utf-8`);
  });
});
