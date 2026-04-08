import Fastify, { FastifyInstance } from 'fastify';
import { serializationPlugin } from '../serialization.js';
import { configPlugin } from "../config.js";
import { errorPlugin } from "../error.js";
import { routesPlugin } from "../routes.js";
import { DMPToolDMPType } from "@dmptool/types";

describe('serializationPlugin', () => {
  let fastify: FastifyInstance;
  let dmp: DMPToolDMPType;

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

    await fastify.register(routesPlugin, {prefix: '/api/v3'});

    const getResp = await fastify.inject({
      method: 'GET',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
    });
    dmp = getResp.json();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it ('should return a not_found error', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v3/test-dmp-id`,
    });

    expect(response.statusCode).toEqual(404);
    const json = response.json();
    expect(json.error_code).toEqual('not_found');
  });

  it ('should return a bad_request error when an expected Header is missing', async () => {
    const response = await fastify.inject({
      method: 'PUT',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      body: {
        dmp: {
          ...dmp.dmp,
          title: 'Updated title'
        }
      }
    });

    expect(response.statusCode).toEqual(400);
    const json = response.json();
    const expectedMsg = 'Headers: headers must have required property \'if-unmodified-since\'';
    expect(json.error_code).toEqual('bad_request');
    expect(json.message).toEqual(expectedMsg);
  });

  it ('should return a dmp_invalid error when the DMP body is invalid', async () => {
    const response = await fastify.inject({
      method: 'PUT',
      url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      body: {
        ...dmp.dmp,
        title: 'Updated title'
      }
    });

    expect(response.statusCode).toEqual(400);
    const json = response.json();
    const expectedMsg = 'Invalid DMP record: body must have required property \'dmp\', body must have required property \'dmp\'';
    expect(json.error_code).toEqual('dmp_invalid');
    expect(json.message).toEqual(expectedMsg);
  });
});
