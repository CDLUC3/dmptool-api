import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { errorHandler, notFoundHandler } from "../error.js";
import { ConfigurationOptions } from "../../types.js";

describe('notFoundHandler', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  const dmpIdShoulder = '10.12345/DMP';

  beforeEach(() => {
    mockRequest = {
      url: '/api/test',
      method: 'GET',
    };

    mockReply = {
      status: jest.fn().mockReturnThis() as any,
      send: jest.fn().mockReturnThis() as any,
    };
  });

  it('should return 404 error for route without DMP ID', () => {
    notFoundHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, dmpIdShoulder);

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      status_code: '404',
      error_code: 'not_found',
      message: 'Route GET:/api/test not found.',
    });
  });

  it('should return 404 error with encoding hint for route with DMP ID', () => {
    mockRequest.url = `/api/dmps/${dmpIdShoulder}123`;

    notFoundHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, dmpIdShoulder);

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      status_code: '404',
      error_code: 'not_found',
      message: `Route GET:/api/dmps/${dmpIdShoulder}123 not found. Make sure the DMP id is URL encoded.`,
    });
  });

  it('should handle POST method correctly', () => {
    mockRequest.method = 'POST';
    mockRequest.url = '/api/create';

    notFoundHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, dmpIdShoulder);

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      status_code: '404',
      error_code: 'not_found',
      message: 'Route POST:/api/create not found.',
    });
  });
});

describe('errorHandler', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockConfig: ConfigurationOptions;

  beforeEach(() => {
    mockConfig = {
      payloadSizeLimit: 10,
    } as ConfigurationOptions;

    mockRequest = {
      log: {
        error: jest.fn(),
      } as any,
      dmptoolConfig: mockConfig,
    };

    mockReply = {
      status: jest.fn().mockReturnThis() as any,
      send: jest.fn().mockReturnThis() as any,
    };
  });

  describe('Validation errors', () => {
    it('should handle headers validation error', () => {
      const error: Partial<FastifyError> = {
        validation: [{message: 'Invalid header'}] as any,
        validationContext: 'headers',
        message: 'Invalid header value',
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockRequest.log?.error).toHaveBeenCalledWith(error);
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'bad_request',
        message: 'Headers: Invalid header value',
      });
    });

    it('should handle querystring validation error', () => {
      const error: Partial<FastifyError> = {
        validation: [{message: 'Invalid query'}] as any,
        validationContext: 'querystring',
        message: 'Invalid query parameter',
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'bad_request',
        message: 'Query string: Invalid query parameter',
      });
    });

    it('should handle params validation error', () => {
      const error: Partial<FastifyError> = {
        validation: [{message: 'Invalid param'}] as any,
        validationContext: 'params',
        message: 'Invalid parameter',
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'bad_request',
        message: 'Parameters: Invalid parameter',
      });
    });

    it('should handle body validation error with dmp_invalid code', () => {
      const error: Partial<FastifyError> = {
        validation: [{message: 'Invalid body'}] as any,
        validationContext: 'body',
        message: 'body.title must be string',
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'dmp_invalid',
        message: 'Invalid DMP record: body.title must be string',
      });
    });

    it('should clean up anyOf error message for body validation', () => {
      const error: Partial<FastifyError> = {
        validation: [{message: 'Invalid body'}] as any,
        validationContext: 'body',
        message: 'body.title must be string, body must match a schema in anyOf',
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'dmp_invalid',
        message: 'Invalid DMP record: body.title must be string',
      });
    });
  });

  describe('Fastify error codes', () => {
    it('should handle FST_ERR_CTP_EMPTY_JSON_BODY error', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
        message: 'Body cannot be empty when content-type is set to application/json',
        statusCode: 400,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'dmp_invalid',
        message: 'Body cannot be empty when content-type is set to application/json',
      });
    });

    it('should handle FST_ERR_VALIDATION error', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_ERR_VALIDATION',
        message: 'Validation failed',
        statusCode: 400,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'dmp_invalid',
        message: 'Validation failed',
      });
    });

    it('should handle FST_ERR_NOT_FOUND error', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_ERR_NOT_FOUND',
        message: 'Route not found',
        statusCode: 404,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 404,
        error_code: 'not_found',
        message: 'Route not found',
      });
    });

    it('should handle FST_JWT_AUTHORIZATION_TOKEN_INVALID error', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_JWT_AUTHORIZATION_TOKEN_INVALID',
        message: 'Authorization token is invalid',
        statusCode: 401,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 401,
        error_code: 'authentication_required',
        message: 'Missing or invalid token',
      });
    });

    it('should handle FST_JWT_NO_AUTHORIZATION_IN_HEADER error', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_JWT_NO_AUTHORIZATION_IN_HEADER',
        message: 'No Authorization was found in request.headers',
        statusCode: 401,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 401,
        error_code: 'authentication_required',
        message: 'Missing or invalid token',
      });
    });

    it('should handle FST_ERR_CTP_INVALID_PARSE_TYPE error', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_ERR_CTP_INVALID_PARSE_TYPE',
        message: 'The content type application/xml is not supported',
        statusCode: 406,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(406);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 406,
        error_code: 'not_acceptable',
        message: 'The content type application/xml is not supported',
      });
    });

    it('should handle FST_ERR_CTP_INVALID_MEDIA_TYPE error', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
        message: 'Unsupported Media Type: application/xml',
        statusCode: 415,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(415);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 415,
        error_code: 'unsupported_media_type',
        message: 'Unsupported Media Type: application/xml',
      });
    });

    it('should handle FST_ERR_CTP_BODY_TOO_LARGE error with custom message', () => {
      const error: Partial<FastifyError> = {
        code: 'FST_ERR_CTP_BODY_TOO_LARGE',
        message: 'Request body is too large',
        statusCode: 413,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(413);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 413,
        error_code: 'payload_too_large',
        message: 'The DMP was too large. Please keep it under 10MB',
      });
    });
  });

  describe('HTTP status codes', () => {
    it('should handle 404 status code', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_CODE',
        message: 'Resource not found',
        statusCode: 404,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 404,
        error_code: 'not_found',
        message: 'Resource not found',
      });
    });

    it('should handle 401 status code', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_AUTH_ERROR',
        message: 'Unauthorized',
        statusCode: 401,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 401,
        error_code: 'authentication_required',
        message: 'Missing or invalid token',
      });
    });

    it('should handle 403 status code as 401', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_CODE',
        message: 'Forbidden',
        statusCode: 403,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 401,
        error_code: 'authentication_required',
        message: 'Missing or invalid token',
      });
    });

    it('should handle 406 status code', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_CODE',
        message: 'Not acceptable',
        statusCode: 406,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(406);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 406,
        error_code: 'not_acceptable',
        message: 'Not acceptable',
      });
    });

    it('should handle 413 status code', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_CODE',
        message: 'Payload too large',
        statusCode: 413,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(413);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 413,
        error_code: 'payload_too_large',
        message: 'The DMP was too large. Please keep it under 10MB',
      });
    });

    it('should handle 415 status code', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_CODE',
        message: 'Unsupported media type',
        statusCode: 415,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(415);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 415,
        error_code: 'unsupported_media_type',
        message: 'Unsupported media type',
      });
    });

    it('should handle other 4xx errors with original message', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_CODE',
        message: 'Bad request custom message',
        statusCode: 400,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'SOME_CODE',
        message: 'Bad request custom message',
      });
    });

    it('should handle 500 status code with generic message', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_INTERNAL_ERROR',
        message: 'Database connection failed',
        statusCode: 500,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 500,
        error_code: 'generic_error',
        message: 'Internal server error',
      });
    });

    it('should handle other 5xx errors with generic message', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_CODE',
        message: 'Gateway timeout',
        statusCode: 504,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(504);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 504,
        error_code: 'SOME_CODE',
        message: 'Internal server error',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle error without statusCode', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_ERROR',
        message: 'Error without status code',
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 500,
        error_code: 'generic_error',
        message: 'Internal server error',
      });
    });

    it('should handle error without code', () => {
      const error: Partial<FastifyError> = {
        message: 'Error without code',
        statusCode: 500,
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 500,
        error_code: 'generic_error',
        message: 'Internal server error',
      });
    });

    it('should handle error with validation context but without specific case', () => {
      const error: Partial<FastifyError> = {
        validation: [{message: 'Invalid'}] as any,
        validationContext: 'unknown' as any,
        message: 'Unknown validation error',
      };

      errorHandler(mockRequest as FastifyRequest, mockReply as FastifyReply, error as FastifyError);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'bad_request',
        message: 'Unknown validation error',
      });
    });
  });
});
