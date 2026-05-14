import { FastifyRequest } from "fastify";
import {
  ApolloClient,
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError
} from "@apollo/client/core";
import QueryOptions = ApolloClient.QueryOptions;
import MutationOptions = ApolloClient.MutateOptions;
import QueryResult = ApolloClient.QueryResult;
import MutateResult = ApolloClient.MutateResult;
import {ProjectInterface} from "./Project.js";

export interface GQLResponse<T> {
  data?: T;
  error?: GQLErrorInterface;
}

export interface GQLErrorInterface {
  status: number;
  message: string;
}

export class BaseGraphQLModel {
  id?: number;
  created?: string;
  modified?: string;
  createdById?: number;
  modifiedById?: number;

  errors: Record<string, string> = {};

  constructor(options: Partial<BaseGraphQLModel> = {}) {
    Object.assign(this, options);
  }

  /**
   * Helper function to concatenate all error into a single string
   *
   * @param errors The errors object
   * @returns a true if any of the error values are present
   */
  static hasErrors(errors: Record<string, string>): boolean {
    return Object.keys(errors)
      .filter(k => k !== '__typename')
      .some(k => errors[k] && errors[k] !== null);
  }

  /**
   * Helper function to concatenate all error into a single string
   *
   * @param errors The errors object
   * @returns a concatenated string
   */
  static errorsToString(errors: Record<string, string>): string {
    return Object.keys(errors)
      .filter(k => k !== '__typename' && !errors[k] && errors[k] !== null)
      .map(key => `${key}: ${errors[key]}`)
      .join(', ');
  }

  /**
   * Helper function to handle any GraphQL errors from a Project mutation response
   *
   * @param context the context of the error (e.g. "create", "update", "delete")
   * @param gqlResponse the GraphQL response from the mutation
   * @param mutationErrors any errors that were attached to the response object by Apollo
   */
  handleMutationErrors<T>(
    context: string,
    gqlResponse: GQLResponse<T>,
    mutationErrors: Record<string, string> = {}
  ): void {
    if (!gqlResponse) {
      this.errors.graphQL = `Failed to ${context} project`;
      return;
    }

    if (gqlResponse.error) this.errors.graphQL = gqlResponse.error.message;

    if (mutationErrors && BaseGraphQLModel.hasErrors(mutationErrors)) this.errors = mutationErrors;
  }

  /**
   * Prepare the headers that will be sent to the Apollo Server
   *
   * @param request the Fastify request
   * @returns the headers
   */
  private static prepareHeaders(request: FastifyRequest): Record<string, string> {
    const jwt: string = request.cookies[request.dmptoolConfig.jwtCookieName || ''] || '';
    return {
      'Content-Type': 'application/json',
      cookie: `${request.dmptoolConfig.jwtCookieName}=${jwt}`,
    }
  }

  /**
   * Helper to execute a mutation/query and automatically populate the 'errors',
   * `id`, `created`, and `modified` properties.
   */
  protected async execute<T>(
    action: () => Promise<GQLResponse<T>>,
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractErrors: (data: any) => any = (data) => data?.errors
  ): Promise<boolean> {
    this.errors = {}; // Reset errors before execution
    const resp: GQLResponse<T> = await action();

    if (resp.error) {
      this.errors.graphQL = resp.error.message;
    }

    if (resp.data) {
      const dataErrors = extractErrors(resp.data);
      if (dataErrors) {
        this.errors = { ...this.errors, ...dataErrors };
      }
    }

    // Returns true if we have data and no errors occurred
    return !!resp.data && Object.keys(this.errors).length === 0;
  }

  /**
   * Convert the GraphQL result to a more useful format
   *
   * @param request the Fastify request
   * @param queryOptions the GraphQL query options
   * @param isRetry whether the mutation is a retry after token refresh
   * @returns the converted result
   */
  static async query<T>(
    request: FastifyRequest,
    queryOptions: QueryOptions,
    isRetry = false,
  ): Promise<GQLResponse<T>> {
    if (!request.graphQLClient) throw new Error('GraphQL client not initialized');

    const gqlContext = {
      ...queryOptions,
      context: {
        headers: BaseGraphQLModel.prepareHeaders(request)
      },
      fetchPolicy: "no-cache" // Ensure we always get the latest data and errors
    } as QueryOptions;

    try {
      request.log.debug({ queryOptions }, 'Sending GraphQL query.')
      const result: QueryResult<unknown> = await request.graphQLClient.query(gqlContext);
      const data = result.data as T;

console.log('QUERY RETURNING', result.data as T)

      return { data };
    } catch (err) {
      const gqlError: GQLErrorInterface = this.handleError(request, err);

      // If this wasn't already a retry due to an expired token
      if (!isRetry && gqlError.status === 401) {
        request.log.debug('401 detected. Attempting to refresh token');

        // Refresh the token and try again
        const refreshSuccessful: boolean = await this.refreshToken(request);
        if (refreshSuccessful) {
          request.log.debug('Refresh success. Retrying GraphQL query');

          return this.query<T>(request, queryOptions, true);
        }
      }

      return { error: gqlError, data: undefined };
    }
  }

  /**
   * Send a GraphQL mutation and return the result.
   *
   * @param request the Fastify request
   * @param mutationOptions the GraphQL mutation options
   * @param isRetry whether the mutation is a retry after token refresh
   */
  static async mutate<T>(
    request: FastifyRequest,
    mutationOptions: MutationOptions,
    isRetry = false,
  ): Promise<GQLResponse<T>> {
    if (!request.graphQLClient) throw new Error('GraphQL client not initialized');

    const gqlContext = {
      ...mutationOptions,
      context: {
        headers: BaseGraphQLModel.prepareHeaders(request)
      }
    }

    try {
      request.log.debug({ mutationOptions }, 'Sending GraphQL mutation.')
      const result: MutateResult<unknown> = await request.graphQLClient.mutate(gqlContext);

      if (result.error || !result.data) {
        request.log.error({ error: result.error }, 'Unable to process GraphQL mutation.');
        // result.data.error = result.error;
        return { error: this.handleError(request, result.error) };
      }

console.log('MUTATION RETURNING', result.data as T)

      return { data: result.data as T };
    } catch (err) {
      const gqlError: GQLErrorInterface = this.handleError(request, err);

      // If this wasn't already a retry due to an expired token
      if (!isRetry && gqlError.status === 401) {
        request.log.debug('401 detected. Attempting to refresh token');

        // Refresh the token and try again
        const refreshSuccessful: boolean = await this.refreshToken(request);
        if (refreshSuccessful) {
          request.log.debug('Refresh success. Retrying GraphQL mutation');

          return BaseGraphQLModel.mutate<T>(request, mutationOptions, true);
        }
      }
      return { error: gqlError };
    }
  }

  /**
   * Error handler. Not that all errors are first processed by the Errorlink
   * defined in plugins/graphQL.ts.
   *
   * @param request the Fastify request
   * @param err the error
   * @returns the processed/converted error
   */
  static handleError(
    request: FastifyRequest,
    err: unknown
  ): GQLErrorInterface {
    let status = 500;

    // GraphQL Query/Mutation Logic Errors (Bad Query/400)
    if (CombinedGraphQLErrors.is(err)) {
      // We don't want to surface these, so just log them
      request.log.fatal({ errors: err.errors }, 'GraphQL Logic Error');
    }

    // GraphQL Protocol errors (intentional GraphQL formatted errors)
    if (CombinedProtocolErrors.is(err)) {
      const error = Array.isArray(err.errors) ? err.errors[0] : undefined;

console.log('ERROR:', error?.extensions)

      status = error?.extensions?.code ?? 500;
    }

    // An unintentional error
    if (err instanceof Error && 'statusCode' in err) {
      status = (err as unknown as ServerError).statusCode;
    }

    switch (status) {
      case 401:
        return { status: 401, message: 'Unauthenticated' };
      case 403:
        return { status: 403, message: 'Unauthorized' };
      case 404:
        return { status: 404, message: 'Not Found' };
      default:
        if (err) {
          request.log.fatal(
            { errors: CombinedProtocolErrors.is(err) ? err.errors : [err] },
            'GraphQL Fatal Error'
          );
        } else {
          request.log.fatal('GraphQL Fatal Error: UNDEFINED ERROR!')
        }
        return { status: 500, message: 'Internal Server Error' };
    }
  }

  /**
   * Handler for token refresh and retry
   *
   * @param request the Fastify request
   * @returns true if the token was successfully refreshed
   */
  static async refreshToken(
    request: FastifyRequest
  ): Promise<boolean> {
    request.log.debug('Trying to refresh the caller\'s auth token');

    // TODO: Once we tackle auth, we should implement token refresh logic
    return false;
  }
}
