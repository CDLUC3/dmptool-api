import fp from "fastify-plugin";
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from 'fastify';

/**
 * Encapsulates the error handler that handles errors thrown by the API.
 *
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
export const errorPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {
  // Define the error handler (based on the RDA Common API specification)
  fastify.setErrorHandler((
    error: FastifyError,
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    // Check if it's a validation error (like a missing header or invalid query string parameter)
    if (error.validation) {
      switch (error.validationContext) {
        case 'headers':
          return reply.status(400).send({
            status_code: "400",
            error_code: "bad_request",
            message: `Headers: ${error.message}`
          });
        case 'querystring':
          return reply.status(400).send({
            status_code: "400",
            error_code: "bad_request",
            message: `Query string: ${error.message}`
          });
        case 'params':
          return reply.status(400).send({
            status_code: "400",
            error_code: "bad_request",
            message: `Parameters: ${error.message}`
          });
        case 'body':
          return reply.status(400).send({
            status_code: "400",
            error_code: "dmp_invalid",
            message: `Invalid DMP record: ${error.message.replace(', body must match a schema in anyOf', '')}`
          });
        default:
          return reply.status(400).send({
            status_code: "400",
            error_code: "bad_request", // Or a specific code from your spec
            message: error.message
          });
      }
    }

    // Handle other errors
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      status_code: statusCode.toString(),
      error_code: error.code || "generic_error",
      message: error.message
    });
  });
});
