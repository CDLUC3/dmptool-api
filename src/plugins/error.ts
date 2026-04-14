import fp from "fastify-plugin";
import { ApiError } from "../types.js";
import { ConfigurationOptions } from "../types.js";
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from 'fastify';

const GENERIC_ERROR_MESSAGE = 'Internal server error';

// The default 500 error
const DEFAULT_ERROR: ApiError = {
  status_code: 500,
  error_code: 'generic_error',
  message: GENERIC_ERROR_MESSAGE
}

// Convert a Fastify Error into an API error (Based on RDA Common Standard format)
const fastifyErrorToApiError = (
  err: FastifyError,
  config: ConfigurationOptions
): ApiError => {
  if (!err) return DEFAULT_ERROR;

  // Map Internal Fastify Errors to RDA Common Standard errors
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'generic_error';
  let message = 'Internal server error';

  // Map specific technical codes to spec-friendly codes
  if (['FST_ERR_CTP_EMPTY_JSON_BODY', 'FST_ERR_VALIDATION'].includes(err.code)) {
    statusCode = 400;
    errorCode = 'dmp_invalid';
    message = err.message;
  } else if (err.code === 'FST_ERR_NOT_FOUND' || statusCode === 404) {
    statusCode = 404;
    errorCode = 'not_found';
    message = err.message;
  } else if (err.code.startsWith('FST_JWT_') || [401, 403].includes(statusCode)) {
    // Always return a Fastify 401 or 403 as a 401 to prevent someone fishing for valid DMPs
    statusCode = 401;
    errorCode = 'authentication_required';
    message = 'Missing or invalid token';
  } else if (err.code === 'FST_ERR_CTP_INVALID_PARSE_TYPE' || statusCode === 406) {
    statusCode = 406;
    errorCode = 'not_acceptable'
    message = err.message;
  } else if (err.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || statusCode === 415) {
    statusCode = 415;
    errorCode = 'unsupported_media_type'
    message = err.message;
  } else if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE' || statusCode === 413) {
    statusCode = 413;
    errorCode = 'payload_too_large';
    message = `The DMP was too large. Please keep it under ${config.payloadSizeLimit}MB`;
  } else if (statusCode < 500) {
    // For 4xx errors that aren't validation, we can usually trust the error message
    message = err.message;
  }

  return { status_code: statusCode, error_code: errorCode, message };
}

/**
 * Encapsulates the error handler that handles errors thrown by the API.
 *
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
export const errorPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {

  fastify.setErrorHandler((
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    // Log the original error with request context for debugging
    request.log.error(error);

    // Handle AJV Validation Errors (Fastify-specific)
    if (error.validation) {
      let errorCode = 'bad_request';
      let messagePrefix = '';

      switch (error.validationContext) {
        case 'headers':
          messagePrefix = 'Headers: ';
          break;
        case 'querystring':
          messagePrefix = 'Query string: ';
          break;
        case 'params':
          messagePrefix = 'Parameters: ';
          break;
        case 'body':
          errorCode = 'dmp_invalid';
          messagePrefix = 'Invalid DMP record: ';
          break;
      }

      // Clean up the body error message if necessary
      const cleanMessage = error.message.replace(', body must match a schema in anyOf', '');

      // Return the validation error in our API error format
      return reply.status(400).send({
        status_code: 400,
        error_code: errorCode,
        message: `${messagePrefix}${cleanMessage}`
      });
    }

    // Otherwise convert the Fastify error to our API error
    const errOut: ApiError = fastifyErrorToApiError(error, request.dmptoolConfig);
    reply.status(errOut.status_code).send(errOut);
  });
});
