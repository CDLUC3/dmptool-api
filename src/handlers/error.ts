import { ApiError } from "../types.js";
import { ConfigurationOptions } from "../types.js";
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

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
  } else if (err.code.startsWith('FST_JWT_') || statusCode === 401) {
    statusCode = 401;
    errorCode = 'authentication_required';
    message = 'Missing or invalid token';
  } else if (statusCode === 403) {
    statusCode = 403;
    errorCode = 'authentication_required';
    message = 'Insufficient permissions';
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
  } else if (statusCode === 500) {
    statusCode = 500;
    errorCode = 'generic_error';
    message = GENERIC_ERROR_MESSAGE;
  }

  return { status_code: statusCode, error_code: errorCode, message };
}

/**
 * Handler for 404 errors.
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
    error_code: 'not_found',
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
      error_code: 'generic_error',
      message: GENERIC_ERROR_MESSAGE,
    });
  }

  const err: FastifyError = error as FastifyError;

  // Handle AJV Validation Errors (Fastify-specific)
  if (err.validation) {
    // Always log the original error with request context for debugging
    request.log.warn({ error: err }, 'Validation exception!');

    let errorCode = 'bad_request';
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
