import { ApiError } from "../types.js";
import { ConfigurationOptions } from "../types.js";
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

// Codes and messages are derived from the RDA Common API Specification
//   See: https://github.com/RDA-DMP-Common/common-madmp-api/blob/69c9ac87d4acb04975fb7ad803cfc1dfef2c4620/openapi.yaml#L562
export const ERROR_CODE_BAD_REQUEST = 'bad_request';                   // 400
export const ERROR_MSG_BAD_REQUEST = 'The request is invalid.';
export const ERROR_CODE_INVALID_DMP = 'dmp_invalid';                   // 400
export const ERROR_MSG_INVALID_DMP = 'The DMP is invalid. Please use /dmps/validate for more information.';
export const ERROR_CODE_INVALID_QUERY_STRING = 'invalid_query_string'; // 400
export const ERROR_MSG_INVALID_QUERY_STRING = 'The query string is invalid.';
export const ERROR_CODE_ALREADY_EXISTS = 'dmp_already_exists';         // 400
export const ERROR_MSG_ALREADY_EXISTS = 'The DMP already exists and cannot be created again.';
export const ERROR_CODE_UNAUTHENTICATED = 'authentication_required';   // 401
export const ERROR_MSG_UNAUTHENTICATED = 'Authentication required to perform the specified request.';
export const ERROR_CODE_FORBIDDEN = 'insufficient_permissions';        // 403
export const ERROR_MSG_FORBIDDEN = 'The current user has insufficient permissions to perform this action';
export const ERROR_CODE_NOT_FOUND = 'dmp_not_found';                   // 404
export const ERROR_MSG_NOT_FOUND = 'The DMP could not be found.';
export const ERROR_CODE_NOT_ACCEPTABLE = 'not_acceptable';             // 406
export const ERROR_MSG_NOT_ACCEPTABLE = 'The client has requested a DMP standard that the server cannot fulfill.';
export const ERROR_CODE_CONFLICT = 'conflict';                         // 409
export const ERROR_MSG_CONFLICT = 'The DMP has been modified since the time specified in the If-Unmodified-Since header';
export const ERROR_CODE_PAYLOAD_TOO_LARGE = 'payload_too_large';       // 413
export const ERROR_MSG_PAYLOAD_TOO_LARGE = (val: number) => `The DMP was too large. Please keep it under ${val}MB`;
export const ERROR_CODE_BAD_MIME_TYPE = 'unsupported_media_type';      // 415
export const ERROR_MSG_BAD_MIME_TYPE = 'The server cannot process the DMP sent by the client because it does not support th specified MIME type.';
export const ERROR_CODE_INTERNAL_SERVER = 'generic_error';             // 500
export const ERROR_MSG_INTERNAL_SERVER = 'Internal server error';

// The default 500 error
const DEFAULT_ERROR: ApiError = {
  status_code: 500,
  error_code: ERROR_CODE_INTERNAL_SERVER,
  error_message: ERROR_MSG_INTERNAL_SERVER
}

// Convert a Fastify Error into an API error (Based on RDA Common Standard format)
const fastifyErrorToApiError = (
  err: FastifyError,
  config: ConfigurationOptions
): ApiError => {
  if (!err) return DEFAULT_ERROR;

  // Map Internal Fastify Errors to RDA Common Standard errors
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || ERROR_CODE_INTERNAL_SERVER;
  let message = ERROR_MSG_INTERNAL_SERVER;

  // Map specific technical codes to spec-friendly codes
  if (['FST_ERR_CTP_EMPTY_JSON_BODY', 'FST_ERR_VALIDATION', ERROR_CODE_INVALID_DMP].includes(err.code)) {
    statusCode = 400;
    errorCode = ERROR_CODE_INVALID_DMP;
    // We want to include specific reasons why the DMP was invalid so include the message
    message = [ERROR_MSG_INVALID_DMP, err.message].join(': ');
  } else if (['FST_ERR_NOT_FOUND', ERROR_CODE_NOT_FOUND].includes(err.code) || statusCode === 404) {
    statusCode = 404;
    errorCode = ERROR_CODE_NOT_FOUND;
    message = ERROR_MSG_NOT_FOUND;
  } else if (err.code.startsWith('FST_JWT_') || err.code === ERROR_CODE_UNAUTHENTICATED || statusCode === 401) {
    statusCode = 401;
    errorCode = ERROR_CODE_UNAUTHENTICATED;
    message = ERROR_MSG_UNAUTHENTICATED;
  } else if (statusCode === 403 || err.code === ERROR_CODE_FORBIDDEN) {
    statusCode = 403;
    errorCode = ERROR_CODE_FORBIDDEN;
    message = ERROR_MSG_FORBIDDEN;
  } else if (['FST_ERR_CTP_INVALID_PARSE_TYPE', ERROR_CODE_NOT_ACCEPTABLE].includes(err.code) || statusCode === 406) {
    statusCode = 406;
    errorCode = ERROR_CODE_NOT_ACCEPTABLE
    message = ERROR_MSG_NOT_ACCEPTABLE;
  } else if (err.code === ERROR_CODE_NOT_ACCEPTABLE || statusCode === 409) {
    statusCode = 409;
    errorCode = ERROR_CODE_CONFLICT
    message = ERROR_MSG_CONFLICT;
  } else if (['FST_ERR_CTP_INVALID_MEDIA_TYPE', ERROR_CODE_BAD_MIME_TYPE].includes(err.code) || statusCode === 415) {
    statusCode = 415;
    errorCode = ERROR_CODE_BAD_MIME_TYPE
    message = ERROR_MSG_BAD_MIME_TYPE;
  } else if (['FST_ERR_CTP_BODY_TOO_LARGE', ERROR_CODE_PAYLOAD_TOO_LARGE].includes(err.code) || statusCode === 413) {
    statusCode = 413;
    errorCode = ERROR_CODE_PAYLOAD_TOO_LARGE;
    message = ERROR_MSG_PAYLOAD_TOO_LARGE(config.payloadSizeLimit);
  } else if (err.code === ERROR_CODE_INVALID_QUERY_STRING) {
    statusCode = 400;
    errorCode = ERROR_CODE_INVALID_QUERY_STRING
    message = ERROR_MSG_INVALID_QUERY_STRING;
  } else if (err.code === ERROR_CODE_ALREADY_EXISTS) {
    statusCode = 400;
    errorCode = ERROR_CODE_ALREADY_EXISTS;
    message = ERROR_MSG_ALREADY_EXISTS;
  } else if (statusCode < 500) {
    // For 4xx errors that aren't validation, we can usually trust the error message
    message = ERROR_MSG_BAD_REQUEST;
  } else if (statusCode === 500) {
    statusCode = 500;
    errorCode = ERROR_CODE_INTERNAL_SERVER;
    message = ERROR_MSG_INTERNAL_SERVER;
  }

  return { status_code: statusCode, error_code: errorCode, error_message: message };
}

/**
 * Handler for non-existent endpoints.
 *
 * @param request the Fastify request object
 * @param reply the Fastify reply object
 * @param dmpIdShoulder the DOI shoulder for DMP ids
 */
export const notFoundHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  dmpIdShoulder: string,
): void => {
  const hasDmpId: boolean = request.url.includes(dmpIdShoulder);
  const msg = 'Make sure the DMP id is URL encoded.'
  reply.status(404).send({
    status_code: '404',
    error_code: ERROR_CODE_NOT_FOUND,
    message: `Route ${request.method}:${request.url} not found.${hasDmpId ? ` ${msg}` : ''}`,
  });
  return;
}

/**
 * Encapsulates the error handler that handles errors thrown by the API.
 *
 * @param request the Fastify request object
 * @param reply the Fastify reply object
 * @param error the Fastify error object
 */
export const errorHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  error: FastifyError | Error,
): FastifyReply => {
  // Unhandled errors are NOT FastifyErrors, so handle them here immediately
  if (!Object.hasOwn(error, 'statusCode') || !Object.hasOwn(error, 'code')) {
    request.log.fatal(`Unhandled Exception! ${error.stack}`);

    return reply.status(500).send({
      status_code: 500,
      error_code: ERROR_CODE_INTERNAL_SERVER,
      message: ERROR_MSG_INTERNAL_SERVER,
    });
  }

  const err: FastifyError = error as FastifyError;

  // Handle AJV Validation Errors (Fastify-specific)
  if (err.validation) {
    // Always log the original error with request context for debugging
    request.log.warn({ error: err }, 'Validation exception!');

    let errorCode = ERROR_CODE_BAD_REQUEST;
    let messagePrefix = '';

    switch (err.validationContext) {
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

  // Otherwise it's not a validation error
  const errOut: ApiError = fastifyErrorToApiError(err, request.dmptoolConfig)
  if (errOut.status_code >= 500) {
    request.log.fatal({ error: err, errOut }, 'Fastify fatal exception!');
  } else {
    request.log.warn({ error: err, errOut }, 'Fastify request exception!');
  }

  return reply.status(errOut.status_code).send(errOut);
}
