import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { deleteDmpWorkflow, updateDmpWorkflow } from '../workflowHelper.js';

const makeRequest = (): FastifyRequest =>
  ({
    dmptoolConfig: {
      dmpIdBaseUrl: 'https://doi.org',
      dmpIdShoulder: '10.12345',
      domainName: 'example.com',
    },
  }) as unknown as FastifyRequest;

describe('mutationWorkflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 400 for invalid update dmp id', async () => {
    const result = await updateDmpWorkflow(
      makeRequest(),
      'invalid',
      '2021-01-01T00:00:00Z',
      {
        dmp: {
          modified: '2021-01-01T00:00:00Z',
        },
      } as never
    );

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: 'Invalid DMP ID',
      logLevel: 'warn',
    });
  });

  it('returns 409 for update modified-date mismatch', async () => {
    const result = await updateDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.12345/abc'),
      '2021-01-02T00:00:00Z',
      {
        dmp: {
          modified: '2021-01-01 00:00:00Z',
        },
      } as never
    );

    expect(result).toEqual({
      ok: false,
      statusCode: 409,
      errorCode: 'conflict',
      message: 'The DMP has been modified since the time specified in the If-Unmodified-Since header',
      logLevel: 'warn',
    });
  });

  it('returns success for valid update preconditions', async () => {
    const result = await updateDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.12345/abc'),
      '2021-01-01T00:00:00Z',
      {
        dmp: {
          modified: '2021-01-01 00:00:00Z',
        },
      } as never
    );

    expect(result).toEqual({
      ok: true,
      statusCode: 200,
      body: {
        dmp: {
          modified: '2021-01-01 00:00:00Z',
        },
      },
      lastModified: '2021-01-01 00:00:00Z',
    });
  });

  it('returns 400 for invalid delete dmp id', async () => {
    const result = await deleteDmpWorkflow(
      makeRequest(),
      'invalid',
      '2021-01-01T00:00:00Z',
      '2021-01-01 00:00:00Z'
    );

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: 'Invalid DMP ID',
      logLevel: 'warn',
    });
  });

  it('returns 409 for delete modified-date mismatch', async () => {
    const result = await deleteDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.12345/abc'),
      '2021-01-02T00:00:00Z',
      '2021-01-01 00:00:00Z'
    );

    expect(result).toEqual({
      ok: false,
      statusCode: 409,
      errorCode: 'conflict',
      message: 'The DMP has been modified since the time specified in the If-Unmodified-Since header',
      logLevel: 'warn',
    });
  });

  it('returns success for valid delete preconditions', async () => {
    const result = await deleteDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.12345/abc'),
      '2021-01-01T00:00:00Z',
      '2021-01-01 00:00:00Z'
    );

    expect(result).toEqual({
      ok: true,
      statusCode: 204,
    });
  });
});

