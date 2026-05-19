import { describe, expect, it, jest, afterEach } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { BaseGraphQLModel, type GQLResponse } from '../BaseGQL.js';
import { CombinedGraphQLErrors, CombinedProtocolErrors } from '@apollo/client/core';

class TestModel extends BaseGraphQLModel {
  async runExecute<T>(
    action: () => Promise<GQLResponse<T>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractErrors: (data: any) => any = (data) => data?.errors
  ): Promise<boolean> {
    return this.execute(action, extractErrors);
  }
}

const buildRequest = (): FastifyRequest =>
  ({
    dmptoolConfig: { jwtCookieName: 'jwt' },
    cookies: { jwt: 'token' },
    graphQLClient: {
      query: jest.fn(),
      mutate: jest.fn(),
    },
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('BaseGraphQLModel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should detect errors while ignoring __typename', () => {
    expect(BaseGraphQLModel.hasErrors({ title: 'Missing title' })).toBe(true);
    expect(BaseGraphQLModel.hasErrors({ __typename: 'Foo' })).toBe(false);
    expect(BaseGraphQLModel.hasErrors({ title: '' })).toBe(false);
  });

  it('should stringify errors using current implementation rules', () => {
    const result = BaseGraphQLModel.errorsToString({
      __typename: 'Foo',
      title: 'Missing title',
      note: '',
      other: null as unknown as string,
    });

    expect(typeof result).toBe('string');
  });

  it('should apply graphQL and mutation errors in handleMutationErrors', () => {
    const model = new BaseGraphQLModel();

    model.handleMutationErrors(
      'create',
      { error: { status: 500, message: 'Boom' } },
      { title: 'Required' }
    );

    expect(model.errors).toEqual({ title: 'Required' });
  });

  it('should set a fallback graphQL error when gql response is missing', () => {
    const model = new BaseGraphQLModel();

    model.handleMutationErrors('create', undefined as unknown as GQLResponse<unknown>);

    expect(model.errors.graphQL).toBe('Failed to create project');
  });

  it('should execute successfully without errors', async () => {
    const model = new TestModel();

    const result = await model.runExecute(async () => ({
      data: { id: 123, errors: undefined },
    }));

    expect(result).toBe(true);
    expect(model.errors).toEqual({});
  });

  it('should merge graphQL and extracted errors during execute', async () => {
    const model = new TestModel();

    const result = await model.runExecute(
      async () => ({
        data: { modelErrors: { title: 'Required' } },
        error: { status: 500, message: 'Boom' },
      }),
      (data) => data.modelErrors
    );

    expect(result).toBe(false);
    expect(model.errors).toEqual({
      graphQL: 'Boom',
      title: 'Required',
    });
  });

  it('should throw if query is called without a graphQL client', async () => {
    const request = {
      dmptoolConfig: { jwtCookieName: 'jwt' },
      cookies: {},
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      }
    } as unknown as FastifyRequest;

    await expect(
      BaseGraphQLModel.query(request, { query: {} as never })
    ).rejects.toThrow('GraphQL client not initialized');
  });

  it('should send query with headers and return data', async () => {
    const request = buildRequest();
    const queryMock = request.graphQLClient?.query as jest.Mock;
    queryMock.mockResolvedValue({ data: { ok: true } } as never);

    const response = await BaseGraphQLModel.query<{ ok: boolean }>(request, {
      query: {} as never,
    });

    expect(response).toEqual({ data: { ok: true } });
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          headers: {
            'Content-Type': 'application/json',
            cookie: 'jwt=token',
          },
        },
        fetchPolicy: 'no-cache',
      })
    );
  });

  it('should retry query once after a 401 if refresh succeeds', async () => {
    const request = buildRequest();
    const unauthorized = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const queryMock = request.graphQLClient?.query as jest.Mock;
    queryMock
      .mockRejectedValueOnce(unauthorized as never)
      .mockResolvedValueOnce({ data: { ok: true } } as never);

    jest.spyOn(BaseGraphQLModel, 'refreshToken').mockResolvedValue(true);

    const response = await BaseGraphQLModel.query<{ ok: boolean }>(request, {
      query: {} as never,
    });

    expect(response).toEqual({ data: { ok: true } });
    expect(BaseGraphQLModel.refreshToken).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('should return a handled query error after failed refresh', async () => {
    const request = buildRequest();
    const unauthorized = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const queryMock = request.graphQLClient?.query as jest.Mock;
    queryMock.mockRejectedValueOnce(unauthorized as never);

    jest.spyOn(BaseGraphQLModel, 'refreshToken').mockResolvedValue(false);

    const response = await BaseGraphQLModel.query(request, { query: {} as never });

    expect(response).toEqual({
      error: { status: 401, message: 'Unauthenticated' },
      data: undefined,
    });
  });

  it('should return mutate data when successful', async () => {
    const request = buildRequest();
    const mutateMock = request.graphQLClient?.mutate as jest.Mock;
    mutateMock.mockResolvedValue({ data: { created: true } } as never);

    const response = await BaseGraphQLModel.mutate<{ created: boolean }>(request, {
      mutation: {} as never,
    });

    expect(response).toEqual({ data: { created: true } });
  });

  it('should return a handled error when mutation result has no data', async () => {
    const request = buildRequest();
    const mutateMock = request.graphQLClient?.mutate as jest.Mock;
    mutateMock.mockResolvedValue({ data: undefined, error: undefined } as never);

    const response = await BaseGraphQLModel.mutate(request, {
      mutation: {} as never,
    });

    expect(response).toEqual({
      error: { status: 500, message: 'Internal Server Error' },
    });
    expect(request.log.error).toHaveBeenCalled();
  });

  it('should retry mutate once after a 401 if refresh succeeds', async () => {
    const request = buildRequest();
    const unauthorized = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const mutateMock = request.graphQLClient?.mutate as jest.Mock;
    mutateMock
      .mockRejectedValueOnce(unauthorized as never)
      .mockResolvedValueOnce({ data: { updated: true } } as never);

    jest.spyOn(BaseGraphQLModel, 'refreshToken').mockResolvedValue(true);

    const response = await BaseGraphQLModel.mutate<{ updated: boolean }>(request, {
      mutation: {} as never,
    });

    expect(response).toEqual({ data: { updated: true } });
    expect(BaseGraphQLModel.refreshToken).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  it('should map server status codes in handleError', () => {
    const request = buildRequest();

    const error401 = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const error403 = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    const error404 = Object.assign(new Error('Not found'), { statusCode: 404 });

    expect(BaseGraphQLModel.handleError(request, error401)).toEqual({
      status: 401,
      message: 'Unauthenticated',
    });
    expect(BaseGraphQLModel.handleError(request, error403)).toEqual({
      status: 403,
      message: 'Unauthorized',
    });
    expect(BaseGraphQLModel.handleError(request, error404)).toEqual({
      status: 404,
      message: 'Not Found',
    });
  });

  it('should handle CombinedGraphQLErrors as a fatal 500', () => {
    const request = buildRequest();
    const err = new CombinedGraphQLErrors([
      { message: 'GraphQL failure' } as never,
    ] as never);

    const result = BaseGraphQLModel.handleError(request, err);

    expect(result).toEqual({
      status: 500,
      message: 'Internal Server Error',
    });
    expect(request.log.fatal).toHaveBeenCalled();
  });

  it('should handle CombinedProtocolErrors status code', () => {
    const request = buildRequest();
    const protocolErr = new CombinedProtocolErrors([
      { extensions: { code: 403 } } as never,
    ]);

    const result = BaseGraphQLModel.handleError(request, protocolErr);

    expect(result).toEqual({
      status: 403,
      message: 'Unauthorized',
    });
  });

  it('should return false from refreshToken placeholder', async () => {
    const request = buildRequest();

    await expect(BaseGraphQLModel.refreshToken(request)).resolves.toBe(false);
  });
});
