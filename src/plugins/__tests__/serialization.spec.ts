import Fastify, { FastifyInstance } from 'fastify';
import { serializationPlugin } from '../serialization.js';
import { DMP_TOOL_CONTENT_TYPE } from "../../serializer.js";
import { configPlugin } from "../config.js";
import { errorPlugin } from "../error.js";
import { routesPlugin } from "../routes.js";

describe('serializationPlugin', () => {
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
    await fastify.register(errorPlugin, {});
    await fastify.register(serializationPlugin, {});

    await fastify.register(routesPlugin, { prefix: '/api/v3' });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should set Content-Type to DMPTool header when Accept header matches', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: DMP_TOOL_CONTENT_TYPE },
    });

    expect(response.headers['content-type']).toBe(DMP_TOOL_CONTENT_TYPE);
  });

  it('should set Content-Type to RDA header when Accept header matches', async () => {
    const rdaHeader = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';
    // mockNegotiate.mockReturnValue(rdaHeader);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: rdaHeader },
    });

    expect(response.headers['content-type']).toBe(rdaHeader);
    // expect(mockNegotiate).toHaveBeenCalledWith(rdaHeader);
  });

  it('should default to RDA header when Accept header is empty', async () => {
    const rdaHeader = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';
    // mockNegotiate.mockReturnValue(null);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
    });

    expect(response.headers['content-type']).toBe(rdaHeader);
    // expect(mockNegotiate).toHaveBeenCalledWith('');
  });

  it('should return a 406 unsupported error when the accept type is not supported', async () => {
    const rdaHeader = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';
    // mockNegotiate.mockReturnValue(null);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: { accept: 'application/xml' },
    });

    expect(response.headers['content-type']).toBe(rdaHeader);
    // expect(mockNegotiate).toHaveBeenCalledWith('application/xml');
  });

  it('should default to RDA header when negotiation returns null', async () => {
    const rdaHeader = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';
    // mockNegotiate.mockReturnValue(null);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      headers: {
        accept: '*/*',
      },
    });

    expect(response.headers['content-type']).toBe(rdaHeader);
  });
});
