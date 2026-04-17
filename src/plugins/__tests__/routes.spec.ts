import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import routesPlugin from '../routes.js';
import configPlugin from "../config.js";
import serializationPlugin from "../serialization.js";
import { DMPToolDMPType } from "@dmptool/types";
import {
  DMP_TOOL_CONTENT_TYPE,
  RDA_COMMON_STANDARD_CONTENT_TYPE
} from "../../routeOptions.js";

describe('routesPlugin', () => {
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
    // Register the config and headers plugins first as the routes are dependent on them
    await fastify.register(configPlugin, {});
    await fastify.register(serializationPlugin, {});

    await fastify.register(routesPlugin, { prefix: '/api/v3' });
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /healthcheck', () => {
    it('should return 200 status code', async () => {
      const response  = await fastify.inject({
        method: 'GET',
        url: '/api/v3/healthcheck',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'OK', status_code: '200' });
    });
  });

  describe('GET /dmps', () => {
    it('should return 200 status code', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v3/dmps',
      });

      expect(response.statusCode).toBe(200);
      const payload: { total_count: number, items: DMPToolDMPType[] } = response.json();
      expect(payload.total_count).toEqual(1);
      expect(payload.items[0].dmp.dmp_id).toEqual({ identifier: 'test-dmp-id', type: 'other' });
    });
  });

  describe('GET /dmps/:id(.+)', () => {
    it('should return 200 status code', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });

      expect(response.statusCode).toBe(200);
      const payload: DMPToolDMPType = response.json();
      expect(payload.dmp.dmp_id).toEqual({ identifier: 'test-dmp-id', type: 'other' });
    });

    it('allows us to specify a historical version', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id?version=2020-01-01T10:11:12Z`,
      });

      expect(response.statusCode).toBe(200);
      const payload: DMPToolDMPType = response.json();
      expect(payload.dmp.dmp_id).toEqual({ identifier: 'test-dmp-id', type: 'other' });
    });

    it('should return the DMP in RDA Common Standard format by default', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });

      expect(response.statusCode).toBe(200);
      const contentType: string | undefined = response.headers['content-type'];
      expect(contentType).toEqual(`${RDA_COMMON_STANDARD_CONTENT_TYPE}; charset=utf-8`);
      const dmp: DMPToolDMPType = response.json();
      expect(dmp.dmp).toHaveProperty('dmp_id');
      expect(dmp.dmp).not.toHaveProperty('privacy');
    });

    it('should return the DMP with DMP Tool extensions when specified', async () => {
      const response = await fastify.inject({
        method: 'GET',
        headers: { accept: DMP_TOOL_CONTENT_TYPE },
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });

      expect(response.statusCode).toBe(200);
      const contentType: string | undefined = response.headers['content-type'];
      expect(contentType).toEqual(`${DMP_TOOL_CONTENT_TYPE}; charset=utf-8`);
      const dmp: DMPToolDMPType = response.json();
      expect(dmp.dmp).toHaveProperty('dmp_id');
      expect(dmp.dmp).toHaveProperty('privacy');
    });

    it('should return 404 status code if the DMP ID is not URL encoded', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v3/dmps/${fastify.dmptoolConfig.dmpIdShoulder}test-dmp-id`,
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.error_code).toEqual('not_found');
      expect(json.message.endsWith('Make sure the DMP id is URL encoded.')).toBeTruthy();
    });
  });

  describe('GET /dmps/:id(.+)', () => {
    it('should return 400 status code if the DMP ID is not one of ours', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v3/dmps/${encodeURIComponent('99.99999/Z9')}test-dmp-id`,
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error_code).toEqual('dmp_invalid');
    });
  });

  describe('POST /dmps', () => {
    let dmp: DMPToolDMPType;

    beforeEach(async () => {
      dmp = {
        dmp: {
          title: 'Test DMP for routesPlugin',
          dmp_id: {
            identifier: 'test-routes-123',
            type: 'other'
          },
          created: '2026-04-01 03:11:23Z',
          modified: '2026-04-06 02:23:11Z',
          ethical_issues_exist: 'unknown',
          language: 'eng',
          contact: {
            name: 'Tester',
            mbox: 'tester@example.com',
            contact_id: [{
              identifier: '0000-0000-0000-000x',
              type: 'orcid'
            }]
          },
          dataset: [{
            title: 'Test Dataset 123',
            dataset_id: {
              identifier: '123',
              type: 'other'
            },
            personal_data: 'unknown',
            sensitive_data: 'no',
          }],
        }
      };
    });

    it('should return 201 status code if successful', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/v3/dmps`,
        body: dmp
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('PUT /dmps/:id(.+)', () => {
    let updateableDmp: DMPToolDMPType;

    beforeEach(async () => {
      const getResp = await fastify.inject({
        method: 'GET',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });
      updateableDmp = getResp.json();
    });

    it('should return 200 status code if successful', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
        headers: { 'if-unmodified-since': updateableDmp.dmp.modified },
        body: {
          dmp: {
            ...updateableDmp.dmp,
            title: 'Updated Title',
          }
        }
      });
      expect(response.statusCode).toBe(200);
      // TODO: Once the code is actually updating, uncomment this to ensure the update was successful
      // const updated = response.json();
      // expect(updated.dmp.title).toEqual('Updated Title');
    });

    it('should return 400 status code if the DMP ID is not one of ours', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v3/dmps/${encodeURIComponent('99.99999/Z9')}test-dmp-id`,
        headers: { 'if-unmodified-since': updateableDmp.dmp.modified },
        body: updateableDmp
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error_code).toEqual('dmp_invalid');
    });

    it('should return 400 status code if no If-Unmodified-Since header was provided', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
        body: updateableDmp
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error_code).toEqual('bad_request');
    });

    it('should return 409 status code if the If-Unmodified-Since header doesn\'t match the DMP modified', async () => {
      const modified = new Date(updateableDmp.dmp.modified);
      const oneDayAgo = new Date(modified.getTime() - 24 * 60 * 60 * 1000);

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
        headers: { 'if-unmodified-since': oneDayAgo.toISOString() },
        body: updateableDmp
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.error_code).toEqual('conflict');
    });
  });

  describe('DELETE /dmps/:id(.+)', () => {
    let updateableDmp: DMPToolDMPType;

    beforeEach(async () => {
      const getResp = await fastify.inject({
        method: 'GET',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });
      updateableDmp = getResp.json();
    });

    it('should return 204 status code if successful', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
        headers: { 'if-unmodified-since': updateableDmp.dmp.modified },
      });
      expect(response.statusCode).toBe(204);
      // TODO: Once the code is actually updating, uncomment this to ensure the update was successful
      // const updated = response.json();
      // expect(updated.dmp.title).toEqual('Updated Title');
    });

    it('should return 400 status code if no If-Unmodified-Since header was provided', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
        body: updateableDmp
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error_code).toEqual('bad_request');
    });

    it('should return 409 status code if the If-Unmodified-Since header doesn\'t match the DMP modified', async () => {
      const modified = new Date(updateableDmp.dmp.modified);
      const oneDayAgo = new Date(modified.getTime() - 24 * 60 * 60 * 1000);

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v3/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
        headers: { 'if-unmodified-since': oneDayAgo.toISOString() },
        body: updateableDmp
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.error_code).toEqual('conflict');
    });
  });
});
