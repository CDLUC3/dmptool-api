import fp from 'fastify-plugin';
import { FastifyInstance } from "fastify";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  HttpLink,
  InMemoryCache,
  Observable,
} from "@apollo/client/core";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import ErrorHandlerOptions = ErrorLink.ErrorHandlerOptions;
import { GraphQLFormattedError } from "graphql/error/index.js";

// Apollo Server response structure
interface ResponseError {
  response?: {
    status: number;
  };
  statusCode?: number;
}

// Helper to check if the Apollo response includes an error
function isResponseError(error: unknown): error is ResponseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'statusCode' in error)
  );
}

/**
 * Helper function for handling GraphQL Protocol and Network errors
 *
 * @param status the HTTP status code
 * @param error the GraphQL error
 * @param fastify the Fastify request
 */
function handleHttpStatus(
  status: number | undefined,
  error: CombinedProtocolErrors | Error,
  fastify: FastifyInstance
): void {
  switch (status) {
    case 401:
      fastify.log.warn({ status }, '[Apollo error] Unauthorized: Token likely expired.');
      break;
    case 403:
      fastify.log.warn({ status }, '[Apollo error] Forbidden: Insufficient permissions.');
      break;
    case 404:
      fastify.log.warn({ status }, '[Apollo error] Not Found: Endpoint or resource missing.');
      break;
    case 500:
    case 502:
    case 503:
      fastify.log.fatal({ status, error }, '[Apollo error] Apollo Server Critical Failure.');
      break;
    default:
      fastify.log.error({ status }, '[Apollo error] Unexpected Protocol/Network Error.');
  }
}

/**
 * Plugin that adds a GraphQL client to the fastify request
 *
 * Using fastify-plugin to hoist this to the global scope
 */
const graphQLPlugin = fp(async function (fastify: FastifyInstance): Promise<void> {
  if (!fastify.dmptoolConfig.graphQL?.uri) throw new Error("Missing graphQL uri");

  const httpLink = new HttpLink({
    uri: fastify.dmptoolConfig.graphQL.uri,
    fetch
  });

  const errorLink = new ErrorLink(({ error }: ErrorHandlerOptions) => {
    // GraphQL errors (query/mutation issues)
    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({ message, locations, path, extensions }: GraphQLFormattedError) => {

        // If GraphQL returned a 404, this isn't a fatal error
        if (extensions?.code === 'NOT_FOUND') {
          // Returning an empty Observable "completes" the request without throwing
          // This results in the calling code getting an object with `data: undefined`
          // instead of the error continuing up the chain.
          return new Observable((observer): void => {
            observer.next({ data: null });
            observer.complete();
          });
        }

        fastify.log.error({ message, locations, path }, `[Apollo GraphQL error]: ${message}`);
      });

    // Protocol errors (intentionally thrown HTTP 4xx/5xx with a GraphQL-formatted response)
    } else if (CombinedProtocolErrors.is(error)) {
      const status: number | undefined = isResponseError(error) ? error.response?.status : undefined;
      handleHttpStatus(status, error, fastify);

    // Network errors (Connection lost, DNS issues, or non-GraphQL-formatted errors)
    } else {
      let status: number | undefined;

      if (isResponseError(error)) {
        status = error.statusCode ?? error.response?.status;
      }

      if (status) {
        handleHttpStatus(status, error, fastify);
      } else {
        fastify.log.error({ error }, '[Apollo Network Error] - No status code available');
      }
    }
  });

  const authLink: SetContextLink = new SetContextLink(({ headers }) => {
    return {
      credentials: 'include',
      headers: {
        ...headers, // Pass the headers through to Apollo Server
        'CONTENT-TYPE': 'application/json', // Apollo doesn't understand the REST API headers
      }
    };
  })

  const retryLink = new RetryLink({
    attempts: {
      max: 3, // Maximum number of retry attempts
      retryIf: (error) => {
        // Retry on network errors (not GraphQL errors)
        return !CombinedGraphQLErrors.is(error);
      }
    },
    delay: {
      initial: 1000, // Initial delay in milliseconds
      max: 5000, // Maximum delay in milliseconds
      jitter: true // Add random jitter to the delay to help spread out retry attempts and avoid potential overloading of backend system
    }
  });

  // Initialize the Apollo client for GraphQL requests
  const graphQLClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([
      errorLink,
      authLink,
      retryLink,
      httpLink,
    ]),
  });

  // Access via the request object `request.config`
  fastify.decorateRequest(
    'graphQLClient',
    { getter: (): ApolloClient => graphQLClient }
  );

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('GraphQL Plugin has been registered.');
  });
});
export default graphQLPlugin;
