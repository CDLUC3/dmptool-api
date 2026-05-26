import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { DMPToolDMPType } from "@dmptool/types";
import { DMP_TOOL_CONTENT_TYPE, RDA_COMMON_STANDARD_CONTENT_TYPE } from "../routeSchema.js";
import configPlugin from "../../config.js";
import { mockMaDMP, mockMaDMPModule } from "./maDMPMocks.js";

mockMaDMPModule();

jest.unstable_mockModule('../workflows/planWorkflow.js', () => ({
  createPlanWorkflow: jest.fn(),
}));

describe('v3 routes', () => {
  let fastify: FastifyInstance;
  let createPlanWorkflow: jest.Mock;

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

    // Mutating endpoints require an authenticated user.
    fastify.addHook('preValidation', async (request): Promise<void> => {
      request.user = { id: 1, email: 'tester@example.com', role: 'RESEARCHER' };
    });

    // Mutating endpoints require an authenticated user.
    fastify.addHook('preValidation', async (request): Promise<void> => {
      request.user = { id: 1, email: 'tester@example.com', role: 'RESEARCHER' };
    });

    // Import the mocked workflow module first, then routes
    const workflowModule = await import('../workflows/planWorkflow.js');
    createPlanWorkflow = workflowModule.createPlanWorkflow as jest.Mock;
    createPlanWorkflow.mockReset();

    // Must import the routes plugin here because the maDMP functions we need to
    // mock are called in the routes plugin and would override the mocks otherwise
    const v3RoutesPlugin = (await import('../routes.js')).default;
    await fastify.register(v3RoutesPlugin, { prefix: '/api/test' });
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('POST /dmps/validate', () => {
    it('should reject invalid DMP JSON using the RDA Common Standard', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test/dmps/validate',
        body: {
          dmp: {
            contributor: [{
              name: 'Tester',
              role: ['tester'],
              contributor_id: [{
                identifier: '0000-0000-0000-000x',
                type: 'orcid'
              }]
            }],
            description: 'This is an invalid DMP'
          }
        },
        headers: { 'content-type': RDA_COMMON_STANDARD_CONTENT_TYPE }
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error_code).toEqual('dmp_invalid');
      expect(json.status_code).toEqual(400);

      // Should have errors for RDA Common Standard fields
      expect(json.message.startsWith('Invalid DMP record')).toBe(true);
      expect(json.message.includes('contact')).toBe(true);
      expect(json.message.includes('created')).toBe(true);
      expect(json.message.includes('dataset')).toBe(true);
      expect(json.message.includes('dmp_id')).toBe(true);
      expect(json.message.includes('ethical_issues_exist')).toBe(true);
      expect(json.message.includes('language')).toBe(true);
      expect(json.message.includes('modified')).toBe(true);
      expect(json.message.includes('title')).toBe(true);

      // Should not have errors for DMP Tool fields
      expect(json.message.includes('provenance')).toBe(false);
    });

    it('should reject invalid DMP JSON using the DMP Tool Standard', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test/dmps/validate',
        headers: { 'content-type': DMP_TOOL_CONTENT_TYPE },
        body: {
          dmp: {
            contributor: [{
              name: 'Tester',
              role: ['tester'],
              contributor_id: [{
                identifier: '0000-0000-0000-000x',
                type: 'orcid'
              }]
            }],
            description: 'This is an invalid DMP'
          }
        }
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error_code).toEqual('dmp_invalid');
      expect(json.status_code).toEqual(400);

      // Should have errors for RDA Common Standard fields
      expect(json.message.startsWith('Invalid DMP record')).toBe(true);
      expect(json.message.includes('contact')).toBe(true);
      expect(json.message.includes('created')).toBe(true);
      expect(json.message.includes('dataset')).toBe(true);
      expect(json.message.includes('dmp_id')).toBe(true);
      expect(json.message.includes('ethical_issues_exist')).toBe(true);
      expect(json.message.includes('language')).toBe(true);
      expect(json.message.includes('modified')).toBe(true);
      expect(json.message.includes('title')).toBe(true);

      // Should have errors for DMP Tool fields
      expect(json.message.includes('provenance')).toBe(true);
    });

    it('should accept a valid RDA Common Standard DMP', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test/dmps/validate',
        body: mockMaDMP
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.error_code).toBeUndefined();
      expect(json.status_code).toBe(200);
      expect(json.message).toBe('DMP is valid');
    });

    it('should accept a valid DMP Tool Standard DMP', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test/dmps/validate',
        body: mockMaDMP
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.error_code).toBeUndefined();
      expect(json.status_code).toBe(200);
      expect(json.message).toBe('DMP is valid');
    });
  });

  describe('POST /dmps', () => {
    it('returns 201 when createPlanWorkflow succeeds', async () => {
      createPlanWorkflow.mockResolvedValue({
        ok: true,
        statusCode: 201,
        data: {
          dmp: {
            title: 'Route test',
            dmp_id: { identifier: 'generated-1', type: 'other' },
          },
        },
      } as never);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test/dmps',
        body: {
          dmp: {
            title: 'Route test',
            dmp_id: { identifier: 'external-abc', type: 'other' },
            created: '2026-04-01 03:11:23Z',
            modified: '2026-04-06 02:23:11Z',
            ethical_issues_exist: 'unknown',
            language: 'eng',
            contact: {
              name: 'Tester',
              mbox: 'tester@example.com',
              contact_id: [{ identifier: '0000-0000-0000-000x', type: 'orcid' }],
            },
            dataset: [
              {
                title: 'Dataset',
                dataset_id: { identifier: '123', type: 'other' },
                personal_data: 'unknown',
                sensitive_data: 'no',
              },
            ],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        dmp: {
          title: 'Route test',
          dmp_id: { identifier: 'generated-1', type: 'other' },
        },
      });
    });

    it('returns workflow error payload when createPlanWorkflow fails', async () => {
      createPlanWorkflow.mockResolvedValue({
        ok: false,
        statusCode: 400,
        errorCode: 'dmp_invalid',
        message: 'Bad input',
      } as never);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test/dmps',
        body: {
          dmp: {
            title: 'Route test',
            dmp_id: { identifier: 'external-abc', type: 'other' },
            created: '2026-04-01 03:11:23Z',
            modified: '2026-04-06 02:23:11Z',
            ethical_issues_exist: 'unknown',
            language: 'eng',
            contact: {
              name: 'Tester',
              mbox: 'tester@example.com',
              contact_id: [{ identifier: '0000-0000-0000-000x', type: 'orcid' }],
            },
            dataset: [
              {
                title: 'Dataset',
                dataset_id: { identifier: '123', type: 'other' },
                personal_data: 'unknown',
                sensitive_data: 'no',
              },
            ],
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        status_code: 400,
        error_code: 'dmp_invalid',
        message: 'Bad input',
      });
    });

    it('returns dmp_invalid when the payload contains more than one project', async () => {
      createPlanWorkflow.mockResolvedValue({
        ok: false,
        statusCode: 400,
        errorCode: 'dmp_invalid',
        message: 'Only one project is currently supported per DMP.',
        logLevel: 'warn',
      } as never);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test/dmps',
        body: {
          dmp: {
            title: 'Route test',
            dmp_id: { identifier: 'external-abc', type: 'other' },
            created: '2026-04-01 03:11:23Z',
            modified: '2026-04-06 02:23:11Z',
            ethical_issues_exist: 'unknown',
            language: 'eng',
            contact: {
              name: 'Tester',
              mbox: 'tester@example.com',
              contact_id: [{ identifier: '0000-0000-0000-000x', type: 'orcid' }],
            },
            dataset: [
              {
                title: 'Dataset',
                dataset_id: { identifier: '123', type: 'other' },
                personal_data: 'unknown',
                sensitive_data: 'no',
              },
            ],
            project: [
              { title: 'Project one' },
              { title: 'Project two' },
            ],
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        status_code: 400,
        error_code: 'dmp_invalid',
        message: 'Only one project is currently supported per DMP.',
      });
    });
  });

  describe('GET /dmps', () => {
    it('should return 200 status code', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/test/dmps',
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
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });

      expect(response.statusCode).toBe(200);
      const payload: DMPToolDMPType = response.json();
      expect(payload.dmp.dmp_id).toEqual({ identifier: 'test-dmp-id', type: 'other' });
    });

    it('allows us to specify a historical version', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id?version=2020-01-01T10:11:12Z`,
      });

      expect(response.statusCode).toBe(200);
      const payload: DMPToolDMPType = response.json();
      expect(payload.dmp.dmp_id).toEqual({ identifier: 'test-dmp-id', type: 'other' });
    });

    it('should return the DMP in RDA Common Standard format by default', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
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
        url: `/api/test/dmps/${fastify.dmptoolConfig.dmpIdShoulder}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent('99.99999/Z9')}test-dmp-id`,
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error_code).toEqual('dmp_invalid');
    });
  });

  describe('PUT /dmps/:id(.+)', () => {
    let updateableDmp: DMPToolDMPType;

    beforeEach(async () => {
      const getResp = await fastify.inject({
        method: 'GET',
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });
      updateableDmp = getResp.json();
    });

    it('should return 200 status code if successful', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent('99.99999/Z9')}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
      });
      updateableDmp = getResp.json();
    });

    it('should return 204 status code if successful', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
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
        url: `/api/test/dmps/${encodeURIComponent(fastify.dmptoolConfig.dmpIdShoulder)}test-dmp-id`,
        headers: { 'if-unmodified-since': oneDayAgo.toISOString() },
        body: updateableDmp
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.error_code).toEqual('conflict');
    });
  });
});
