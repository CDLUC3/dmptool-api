import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { FastifyRequest } from 'fastify';
import { DocumentNode, Kind } from 'graphql';
import { BaseGraphQLModel, GQLResponse } from '../gqlHelper.js';

const TEST_DOCUMENT: DocumentNode = {
  kind: Kind.DOCUMENT,
  definitions: [],
};

class TestModel extends BaseGraphQLModel {
  async runExecute<T>(
    action: () => Promise<GQLResponse<T>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractErrors?: (data: any) => any
  ): Promise<boolean> {
    return this.execute(action, extractErrors);
  }
}

describe('BaseGraphQLModel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should execute successfully and set base model fields', async () => {
    const model = new TestModel();

    const result = await model.runExecute(async () => ({
      data: {
        id: 123,
        errors: undefined,
      },
    }));

    expect(result).toBe(true);
    expect(model.errors).toEqual({});
    expect(model.id).toBe(123);
    expect(model.createdById).toBe(0);
    expect(model.modifiedById).toBe(0);
    expect(model.created).toBeDefined();
    expect(model.modified).toBeDefined();
  });

  it('should capture GraphQL and domain errors during execute', async () => {
    const model = new TestModel();

    const result = await model.runExecute(
      async () => ({
        data: {
          id: 7,
          modelErrors: { title: 'Title is required' },
        },
        error: { status: 500, message: 'Boom' },
      }),
      (data) => data.modelErrors
    );

    expect(result).toBe(false);
    expect(model.errors).toEqual({
      graphQL: 'Boom',
      title: 'Title is required',
    });
  });

  it('should throw when query is called without a GraphQL client', async () => {
    const request = {
      dmptoolConfig: { jwtCookieName: 'test-cookie' },
      cookies: {},
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    await expect(BaseGraphQLModel.query(request, { query: TEST_DOCUMENT }))
      .rejects
      .toThrow('GraphQL client not initialized');
  });

  it('should send query with expected headers and return data', async () => {
    const queryMock = jest.fn<(ctx: unknown) => Promise<{ data?: unknown; error?: unknown }>>();
    queryMock.mockResolvedValue({ data: { project: { id: 1 } } });
    const request = {
      dmptoolConfig: { jwtCookieName: 'test-cookie' },
      cookies: { 'test-cookie': 'jwt-token' },
      graphQLClient: { query: queryMock },
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    const response = await BaseGraphQLModel.query(request, { query: TEST_DOCUMENT });

    expect(response).toEqual({ data: { project: { id: 1 } } });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
      query: TEST_DOCUMENT,
      context: {
        headers: {
          'Content-Type': 'application/json',
          cookie: 'test-cookie=jwt-token',
        },
      },
    }));
  });

  it('should retry query once after a 401 when refresh succeeds', async () => {
    const unauthorizedError = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const queryMock = jest.fn<(ctx: unknown) => Promise<{ data?: unknown; error?: unknown }>>()
      .mockRejectedValueOnce(unauthorizedError)
      .mockResolvedValueOnce({ data: { plan: { id: 22 } } });

    const request = {
      dmptoolConfig: { jwtCookieName: 'test-cookie' },
      cookies: { 'test-cookie': 'jwt-token' },
      graphQLClient: { query: queryMock },
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    jest.spyOn(BaseGraphQLModel, 'refreshToken').mockResolvedValue(true);

    const response = await BaseGraphQLModel.query(request, { query: TEST_DOCUMENT });

    expect(response).toEqual({ data: { plan: { id: 22 } } });
    expect(BaseGraphQLModel.refreshToken).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('should retry mutation once after a 401 when refresh succeeds', async () => {
    const unauthorizedError = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const mutateMock = jest.fn<(ctx: unknown) => Promise<{ data?: unknown; error?: unknown }>>()
      .mockRejectedValueOnce(unauthorizedError)
      .mockResolvedValueOnce({ data: { updateProject: { id: 88 } } });

    const request = {
      dmptoolConfig: { jwtCookieName: 'test-cookie' },
      cookies: { 'test-cookie': 'jwt-token' },
      graphQLClient: { mutate: mutateMock },
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    jest.spyOn(BaseGraphQLModel, 'refreshToken').mockResolvedValue(true);

    const response = await BaseGraphQLModel.mutate(request, { mutation: TEST_DOCUMENT });

    expect(response).toEqual({ data: { updateProject: { id: 88 } } });
    expect(BaseGraphQLModel.refreshToken).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  it('should return an error for mutation after a 401 when refresh fails', async () => {
    const unauthorizedError = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const mutateMock = jest.fn<(ctx: unknown) => Promise<{ data?: unknown; error?: unknown }>>();
    mutateMock.mockRejectedValueOnce(unauthorizedError);

    const request = {
      dmptoolConfig: { jwtCookieName: 'test-cookie' },
      cookies: { 'test-cookie': 'jwt-token' },
      graphQLClient: { mutate: mutateMock },
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    jest.spyOn(BaseGraphQLModel, 'refreshToken').mockResolvedValue(false);

    const response = await BaseGraphQLModel.mutate(request, { mutation: TEST_DOCUMENT });

    expect(response).toEqual({
      error: {
        status: 401,
        message: 'Unauthenticated',
      },
    });
    expect(BaseGraphQLModel.refreshToken).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('should return an error when mutation response has no data', async () => {
    const mutateMock = jest.fn<(ctx: unknown) => Promise<{ data?: unknown; error?: unknown }>>();
    mutateMock.mockResolvedValue({ data: undefined, error: undefined });

    const request = {
      dmptoolConfig: { jwtCookieName: 'test-cookie' },
      cookies: { 'test-cookie': 'jwt-token' },
      graphQLClient: { mutate: mutateMock },
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    const response = await BaseGraphQLModel.mutate(request, { mutation: TEST_DOCUMENT });

    expect(response).toEqual({
      error: {
        status: 500,
        message: 'Internal Server Error',
      },
    });
    expect(request.log.error).toHaveBeenCalled();
  });

  it('should map server error status codes in handleError', () => {
    const request = {
      log: {
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    const error401 = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const error403 = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    const error404 = Object.assign(new Error('Not found'), { statusCode: 404 });

    expect(BaseGraphQLModel.handleError(request, error401 as Error)).toEqual({
      status: 401,
      message: 'Unauthenticated',
    });
    expect(BaseGraphQLModel.handleError(request, error403 as Error)).toEqual({
      status: 403,
      message: 'Unauthorized',
    });
    expect(BaseGraphQLModel.handleError(request, error404 as Error)).toEqual({
      status: 404,
      message: 'Not Found',
    });
  });

  it('should return 500 for unknown errors in handleError', () => {
    const request = {
      log: {
        fatal: jest.fn(),
      },
    } as unknown as FastifyRequest;

    expect(BaseGraphQLModel.handleError(request, new Error('unexpected'))).toEqual({
      status: 500,
      message: 'Internal Server Error',
    });
    expect(request.log.fatal).toHaveBeenCalled();
  });

  it('should return false from refreshToken placeholder', async () => {
    const request = {
      log: {
        debug: jest.fn(),
      },
    } as unknown as FastifyRequest;

    await expect(BaseGraphQLModel.refreshToken(request)).resolves.toBe(false);
  });
});



